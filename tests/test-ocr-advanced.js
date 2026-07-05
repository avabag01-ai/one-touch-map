// OCR 시뮬레이션 테스트 (사용자 이미지 기반)

const trickyText = `
묵159-20
묵244-127
중. 308 - 83  (손글씨: 점과 띄어쓰기)
중. 227 . 13  (손글씨: 하이픈 대신 점)
망491-6
망494-13
망5l6-6O      (오타 시뮬레이션: 숫자 1->l, 0->O)
중296-28
중324-82
묵244-100
중273-7
중178-23
중123-0
`;

console.log("=== 📸 난이도 '상' 이미지 인식 테스트 ===");

function testProcess(text) {
    // 1. 텍스트 정규화 (오인식 문자 교정)
    // O, o -> 0 / l, I -> 1 / ㅁ -> 0
    let cleanText = text
        .replace(/[oOㅁ]/g, '0')
        .replace(/[lI|]/g, '1');

    console.log(`[전처리 완료] ${cleanText.replace(/\n/g, ' / ')}`);

    const lines = cleanText.split('\n');

    // 정규식: (묵/중/망/신) + (점/공백) + 숫자 + (하이픈/점/공백) + 숫자
    const regex = /([묵중망신])\s*[\.\,]?\s*(\d+)\s*[-\.\,\s]\s*(\d+)/g;
    let count = 0;

    lines.forEach(line => {
        // 공백 제거 및 정리
        const cleanLine = line.trim();
        if (!cleanLine) return;

        let match;
        while ((match = regex.exec(cleanLine)) !== null) {
            const type = match[1];
            const mainNum = match[2];
            const subNum = match[3];

            let fullDong = '';
            if (type === '묵') fullDong = '묵동';
            else if (type === '중') fullDong = '중화동';
            else if (type === '망') fullDong = '망우동';
            else if (type === '신') fullDong = '신내동';

            console.log(`✅ 추출 성공: [${line}] -> "${fullDong} ${mainNum}-${subNum}"`);
            count++;
        }
    });

    console.log(`\n=== 총 ${count}개 주소 완벽 방어! ===`);
}

testProcess(trickyText);
