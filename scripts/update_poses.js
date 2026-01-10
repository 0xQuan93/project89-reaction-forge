
const fs = require('fs');
const path = require('path');

const posesDir = path.join(__dirname, '../src/poses');

console.log('Scanning poses in:', posesDir);

fs.readdir(posesDir, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    files.forEach(file => {
        if (!file.endsWith('.json')) return;

        const filePath = path.join(posesDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(content);

            let changed = false;

            if (json.sceneRotation && json.sceneRotation.y === 180) {
                console.log(`Updating ${file}: sceneRotation.y 180 -> 0`);
                json.sceneRotation.y = 0;
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    });
});
