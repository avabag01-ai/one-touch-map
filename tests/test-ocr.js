// OCR 로직 테스트 스크립트

const sampleText = `
1 묵159-20 정성근
2 묵244-127 김학권
3 중308-83 박재원
4 중228-13 김중호
6 망491-6 김영두
7 망494-13 씨디빌라
8 망516-60 이봉재
9 중296-28 유장현
10 중324-82 위게임
11 묵244-100 오일택
12 중273-7 이정율
13 중178-23 유기호
14 중123-0 이화연립
`;

console.log("=== OCR 주소 추출 테스트 시작 ===");

function testProcess(text) {
    const lines = text.split('\n');
    let count = 0;

    // 정규식: (묵/중/망/신내) + 숫자 + - + 숫자
    // 띄어쓰기 유연하게 처리: "묵 159-20" 또는 "묵159 - 20" 등
    const regex = /([묵중망신])\s?(\d+)[-\s](\d+)/g;

    lines.forEach(line => {
        // 공백 제거 및 정리 (가장 중요한 전처리!)
        const cleanLine = line.replace(/\s+/g, '');

        // 원본 라인 출력
        if (line.trim()) console.log(`[원본] ${line.trim()}`);

        let match;
        // 한 줄에 여러 개가 있을 수도 있으므로 while 사용
        while ((match = regex.exec(cleanLine)) !== null) {
            const type = match[1]; // 묵, 중, 망
            const mainNum = match[2]; // 본번
            const subNum = match[3]; // 부번

            let fullDong = '';
            if (type === '묵') fullDong = '묵동';
            else if (type === '중') fullDong = '중화동';
            else if (type === '망') fullDong = '망우동';
            else if (type === '신') fullDong = '신내동';

            const fullAddress = `${fullDong} ${mainNum}-${subNum}`;

            console.log(` ✅ 추출 성공: ${fullAddress}`);
            count++;
        }
    });

    console.log(`\n=== 총 ${count}개 주소 추출 완료 ===`);
}

testProcess(sampleText);
