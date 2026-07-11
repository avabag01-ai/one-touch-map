import Foundation
import Capacitor
import CoreLocation
import UserNotifications
import AVFoundation

// 원터치맵 지오펜싱 플러그인 (Swift-only, CAPBridgedPlugin 준수)
// 웹(JS)에서 배송지 좌표 목록을 넘기면, 현재 위치에서 "제일 가까운 1곳"만 20m 반경으로
// 감시한다. 그 지점 20m 안에 들어오면 번지수(jibun)만 로컬 알림으로 띄우고, 해당 지점을
// 목록에서 제외한 뒤 그다음으로 가까운 곳을 다시 등록한다. 앱이 백그라운드/종료 상태여도
// iOS가 대신 감시하다 알림을 띄운다.
@objc(GeofencePlugin)
public class GeofencePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate, UNUserNotificationCenterDelegate {

    // --- CAPBridgedPlugin 프로토콜 요구사항 (capacitor.config.json packageClassList 등록으로 자동 로드) ---
    public let identifier = "GeofencePlugin"
    public let jsName = "Geofence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestGeoPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let manager = CLLocationManager()
    // 제일 가까운 곳에 대해 두 개의 리전을 동시에 감시: 100m(예고) + 20m(도착)
    private let regionApproach = "onetouchmap.approach"   // 100m 접근 → 음성 예고
    private let regionArrive = "onetouchmap.arrive"       // 20m 도착 → 알림 + 음성
    private let approachRadius: CLLocationDistance = 100
    private let arriveRadius: CLLocationDistance = 20

    // 현재 감시 중인 타겟 (리전 진입 시 어느 배송지인지 식별용)
    private var currentTargetId: String?
    private var currentTargetJibun: String = ""
    private var approachAnnounced = false   // 이번 타겟 예고 음성 1회만

    // 웹에서 받은 전체 배송지 목록 (등록 후보). 진입 완료한 곳은 여기서 제거.
    private struct Dest {
        let id: String
        let jibun: String   // 알림에 띄울 번지수 (도로명 아님)
        let lat: Double
        let lng: Double
    }
    private var destinations: [Dest] = []
    private var monitoringEnabled = false

    override public func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        // ⚠ 앱이 포그라운드(화면에 떠 있는 상태)일 때 iOS는 기본적으로 알림 배너를 숨긴다.
        // 델리게이트에서 willPresent를 구현해야 앱 사용 중에도 배너가 보임.
        UNUserNotificationCenter.current().delegate = self
    }

    // 앱 사용 중(포그라운드)에도 알림 배너+소리 표시
    public func userNotificationCenter(_ center: UNUserNotificationCenter,
                                       willPresent notification: UNNotification,
                                       withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .sound])
    }

    // MARK: - JS에서 호출하는 메서드

    // 권한 요청 (위치 Always + 알림). 웹에서 지오펜싱 켤 때 먼저 호출.
    @objc func requestGeoPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        DispatchQueue.main.async { self.manager.requestAlwaysAuthorization() }
        call.resolve(["ok": true])
    }

    // 배송지 목록 전달 + 감시 시작. destinations = [{id, jibun, lat, lng}, ...]
    @objc func start(_ call: CAPPluginCall) {
        guard let arr = call.getArray("destinations", JSObject.self) else {
            call.reject("destinations 배열이 필요합니다")
            return
        }
        destinations = arr.compactMap { obj in
            guard let lat = obj["lat"] as? Double,
                  let lng = obj["lng"] as? Double else { return nil }
            let id = (obj["id"] as? String) ?? UUID().uuidString
            let jibun = (obj["jibun"] as? String) ?? ""
            return Dest(id: id, jibun: jibun, lat: lat, lng: lng)
        }
        monitoringEnabled = true
        DispatchQueue.main.async {
            self.manager.startUpdatingLocation()   // 현재 위치 알아야 "제일 가까운 곳" 계산 가능
            self.registerNearest()
        }
        call.resolve(["ok": true, "count": destinations.count])
    }

    // 감시 중단 + 모든 리전 해제
    @objc func stop(_ call: CAPPluginCall) {
        monitoringEnabled = false
        DispatchQueue.main.async {
            for r in self.manager.monitoredRegions { self.manager.stopMonitoring(for: r) }
            self.manager.stopUpdatingLocation()
        }
        call.resolve(["ok": true])
    }

    // MARK: - 핵심 로직: 현재 위치에서 제일 가까운 1곳만 리전 등록

    private func registerNearest() {
        guard monitoringEnabled else { return }
        for r in manager.monitoredRegions { manager.stopMonitoring(for: r) }   // 항상 1개만 유지

        guard let here = manager.location else { return }   // 현재 위치 아직 없으면 위치 콜백에서 재시도
        guard !destinations.isEmpty else { return }

        var nearest: Dest?
        var best = Double.greatestFiniteMagnitude
        for d in destinations {
            let dist = here.distance(from: CLLocation(latitude: d.lat, longitude: d.lng))
            if dist < best { best = dist; nearest = d }
        }
        guard let target = nearest else { return }

        currentTargetId = target.id
        currentTargetJibun = target.jibun
        approachAnnounced = false

        // 100m(예고) + 20m(도착) 두 리전 등록
        let center = CLLocationCoordinate2D(latitude: target.lat, longitude: target.lng)
        for (id, radius) in [(regionApproach, approachRadius), (regionArrive, arriveRadius)] {
            let region = CLCircularRegion(center: center, radius: radius, identifier: id)
            region.notifyOnEntry = true
            region.notifyOnExit = false
            manager.startMonitoring(for: region)
            manager.requestState(for: region)   // 이미 반경 안이면 진입 콜백이 안 오므로 즉시 상태 확인
        }

        // 진단용: 웹에 "지금 어느 주소를 몇 m 거리에서 감시 중인지" 알려줌 (토스트 표시용)
        notifyListeners("registered", data: ["jibun": target.jibun, "distance": Int(best)])
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if monitoringEnabled && manager.monitoredRegions.isEmpty {
            registerNearest()   // 최초 위치 확보 시점에 리전 등록
        }
    }

    public func locationManager(_ m: CLLocationManager, didEnterRegion region: CLRegion) {
        handleRegion(region.identifier)
    }

    public func locationManager(_ m: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        if state == .inside { handleRegion(region.identifier) }
    }

    private func handleRegion(_ id: String) {
        if id == regionArrive { handleArrival() }        // 20m 도착 우선
        else if id == regionApproach { handleApproach() } // 100m 예고
    }

    // 100m 접근 → 음성 예고 1회 ("다음 128 다시 46이요")
    private func handleApproach() {
        guard monitoringEnabled, !approachAnnounced, !currentTargetJibun.isEmpty else { return }
        approachAnnounced = true
        speak(jibun: currentTargetJibun, prefix: "다음 ", suffix: "이요")
        notifyListeners("approach", data: ["jibun": currentTargetJibun])
    }

    // iOS 14+ 권한 변경 콜백 (구식 didChangeAuthorization은 최신 iOS에서 호출 안 될 수 있어 둘 다 구현)
    public func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        guard #available(iOS 14.0, *) else { return }   // 배포타겟 iOS13 호환용 가드
        let status = m.authorizationStatus
        if monitoringEnabled && (status == .authorizedAlways || status == .authorizedWhenInUse) {
            manager.startUpdatingLocation()
            registerNearest()
        }
    }

    public func locationManager(_ m: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        if monitoringEnabled && (status == .authorizedAlways || status == .authorizedWhenInUse) {
            manager.startUpdatingLocation()
            registerNearest()
        }
    }

    private func handleArrival() {
        guard monitoringEnabled else { return }
        // 도착한 곳 = 현재 감시 중이던 타겟
        let arrivedId = currentTargetId
        let arrivedJibun = currentTargetJibun
        guard !arrivedJibun.isEmpty || arrivedId != nil else { return }

        fireNotification(jibun: arrivedJibun)
        speak(jibun: arrivedJibun)   // 에어팟/스피커로 번지수 음성 안내
        notifyListeners("arrived", data: ["id": arrivedId ?? "", "jibun": arrivedJibun])

        // 이 지점 제거 후 다음 제일 가까운 곳 등록
        if let aid = arrivedId, let idx = destinations.firstIndex(where: { $0.id == aid }) {
            destinations.remove(at: idx)
        }
        currentTargetId = nil
        registerNearest()
    }

    private func fireNotification(jibun: String) {
        let content = UNMutableNotificationContent()
        content.title = jibun.isEmpty ? "배송지 도착" : jibun   // 번지수만 크게
        content.sound = .default
        let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    // MARK: - 음성 안내 (TTS)

    private let synthesizer = AVSpeechSynthesizer()

    // "128-46" → "128 다시 46" 으로 읽음 (한국 지번 관용 읽기). 음악 재생 중이면 잠깐 줄이고 말한 뒤 복원.
    // prefix/suffix로 예고("다음 …이요")와 도착(번지수만)을 구분.
    private func speak(jibun: String, prefix: String = "", suffix: String = "") {
        guard !jibun.isEmpty else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { /* 오디오 세션 실패해도 알림은 이미 떴으므로 무시 */ }

        let num = jibun.replacingOccurrences(of: "-", with: " 다시 ")
        let utter = AVSpeechUtterance(string: prefix + num + suffix)
        utter.voice = AVSpeechSynthesisVoice(language: "ko-KR")
        utter.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utter)
    }
}
