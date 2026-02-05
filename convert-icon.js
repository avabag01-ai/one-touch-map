const sharp = require('sharp');
const fs = require('fs');

const svgBuffer = fs.readFileSync('icon.svg');

async function convert() {
    await sharp(svgBuffer).resize(192, 192).png().toFile('icon-192.png');
    await sharp(svgBuffer).resize(512, 512).png().toFile('icon-512.png');
    // Android용 mipmap
    await sharp(svgBuffer).resize(48, 48).png().toFile('android/app/src/main/res/mipmap-mdpi/ic_launcher.png');
    await sharp(svgBuffer).resize(72, 72).png().toFile('android/app/src/main/res/mipmap-hdpi/ic_launcher.png');
    await sharp(svgBuffer).resize(96, 96).png().toFile('android/app/src/main/res/mipmap-xhdpi/ic_launcher.png');
    await sharp(svgBuffer).resize(144, 144).png().toFile('android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
    await sharp(svgBuffer).resize(192, 192).png().toFile('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');
    // Round 아이콘도
    await sharp(svgBuffer).resize(48, 48).png().toFile('android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png');
    await sharp(svgBuffer).resize(72, 72).png().toFile('android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png');
    await sharp(svgBuffer).resize(96, 96).png().toFile('android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png');
    await sharp(svgBuffer).resize(144, 144).png().toFile('android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png');
    await sharp(svgBuffer).resize(192, 192).png().toFile('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png');
    // Foreground
    await sharp(svgBuffer).resize(48, 48).png().toFile('android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png');
    await sharp(svgBuffer).resize(72, 72).png().toFile('android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png');
    await sharp(svgBuffer).resize(96, 96).png().toFile('android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png');
    await sharp(svgBuffer).resize(144, 144).png().toFile('android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png');
    await sharp(svgBuffer).resize(192, 192).png().toFile('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png');
    console.log('All icons generated!');
}
convert();
