// === ⚓️ 주소록 키 시스템 ===
// dong + jibun 직관적 키 사용. 이전 ANCHOR_MAP 6동 하드코딩 제거.

function makeKey(dong, jibun) {
    return `${dong}|${(jibun || '').replace(/\s/g, '')}`;
}

// 마이그레이션: 옛 anchor 키 (A123-45) → 직관 키 (중화동|123-45). 1회만.
(function migrateAddressBookOnce() {
    if (localStorage.getItem('addressBook_migrated_v2')) return;

    const OLD_ANCHOR_TO_DONG = {
        A: '중화동', B: '묵동', C: '망우동',
        D: '신내동', E: '상봉동', F: '면목동'
    };

    const addressBook = JSON.parse(localStorage.getItem('addressBook') || '{}');
    const newBook = {};
    let migrated = 0;

    for (const [key, value] of Object.entries(addressBook)) {
        const dong = OLD_ANCHOR_TO_DONG[key[0]];
        if (dong) {
            newBook[makeKey(dong, key.slice(1))] = value;
            migrated++;
        } else {
            newBook[key] = value;
        }
    }

    localStorage.setItem('addressBook', JSON.stringify(newBook));
    localStorage.setItem('addressBook_migrated_v2', '1');
    if (migrated > 0) console.log(`[주소록] anchor → 직관 키 변환 (${migrated}건)`);
})();

// Master DB 저장 (item: { dong, jibun(addressBefore), phone, tonnage, locationPhoto })
function saveToAddressBook(item) {
    const addressBook = JSON.parse(localStorage.getItem('addressBook') || '{}');
    const key = makeKey(item.dong, item.addressBefore || item.jibun);

    addressBook[key] = {
        p: item.phone || '',
        t: item.tonnage || '',
        img: item.locationPhoto || '',
        ts: Date.now()
    };

    localStorage.setItem('addressBook', JSON.stringify(addressBook));
    console.log(`[주소록] 저장: ${key}`);
}

// DB에서 정보 불러오기
function getFromAddressBook(dong, jibun) {
    const addressBook = JSON.parse(localStorage.getItem('addressBook') || '{}');
    const key = makeKey(dong, jibun);
    const data = addressBook[key];

    if (!data) return null;

    return {
        phone: data.p,
        tonnage: data.t,
        locationPhoto: data.img,
        updatedAt: new Date(data.ts).toISOString().split('T')[0]
    };
}
