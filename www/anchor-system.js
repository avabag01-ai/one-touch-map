// === ⚓️ 앵커 플로우 (데이터 최적화 시스템) ===
// 긴 한글 주소 대신 짧은 기호(Anchor)로 관리하여 속도와 용량을 최적화함

const ANCHOR_MAP = {
    '중화동': 'A',
    '묵동': 'B',
    '망우동': 'C',
    '신내동': 'D',
    '상봉동': 'E',
    '면목동': 'F',
    // 확장 가능: 사용자가 설정에서 동을 추가하면 G, H... 로 늘어나게 할 수도 있음 (지금은 고정)
};

const REVERSE_ANCHOR_MAP = Object.fromEntries(
    Object.entries(ANCHOR_MAP).map(([k, v]) => [v, k])
);

// 주소 -> 앵커 키 변환 (예: 중화동 123-45 -> A123-45, 띄어쓰기 제거)
function toAnchorKey(dong, jibun) {
    const anchor = ANCHOR_MAP[dong] || 'Z'; // Z는 기타(매핑 안된 동)
    // 지번에서 공백 제거 (123 - 45 -> 123-45)
    return `${anchor}${jibun.replace(/\s/g, '')}`;
}

// Master DB (주소록) 저장 (앵커 적용)
// item 객체: { dong, jibun(addressBefore), phone, tonnage, locationPhoto }
function saveToAddressBook(item) {
    const addressBook = JSON.parse(localStorage.getItem('addressBook') || '{}');

    // 앵커 키 생성
    const key = toAnchorKey(item.dong, item.addressBefore || item.jibun);

    addressBook[key] = {
        p: item.phone || '',           // phone -> p (압축)
        t: item.tonnage || '',         // tonnage -> t
        img: item.locationPhoto || '', // locationPhoto -> img
        ts: Date.now()                 // timestamp -> ts
    };

    localStorage.setItem('addressBook', JSON.stringify(addressBook));
    console.log(`[앵커시스템] 저장됨: ${key}`, addressBook[key]);
}

// DB에서 정보 불러오기 (복호화)
function getFromAddressBook(dong, jibun) {
    const addressBook = JSON.parse(localStorage.getItem('addressBook') || '{}');
    const key = toAnchorKey(dong, jibun);
    const data = addressBook[key];

    if (data) {
        console.log(`[앵커시스템] 매칭 성공! (${key})`);
        return {
            phone: data.p,
            tonnage: data.t,
            locationPhoto: data.img,
            updatedAt: new Date(data.ts).toISOString().split('T')[0]
        };
    }
    return null;
}
