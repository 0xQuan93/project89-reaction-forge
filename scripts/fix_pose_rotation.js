const fs = require('fs');
const path = require('path');

const posesDir = path.join(__dirname, '../src/poses');

fs.readdir(posesDir, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    return;
  }

  files.forEach(file => {
    if (path.extname(file) === '.json') {
      const filePath = path.join(posesDir, file);
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading file ${file}:`, err);
          return;
        }

        try {
          const json = JSON.parse(data);
          if (json.sceneRotation && json.sceneRotation.y === 180) {
            json.sceneRotation.y = 0;
            const updatedJson = JSON.stringify(json, null, 2); // Keep formatting?
            // The original files might have specific formatting. 
            // Let's just do a string replace to preserve structure if possible, 
            // but JSON.stringify is safer for correctness.
            // The original files looked like standard JSON.
            
            fs.writeFile(filePath, updatedJson, (err) => {
              if (err) console.error(`Error writing file ${file}:`, err);
              else console.log(`Updated ${file}`);
            });
          }
        } catch (e) {
          console.error(`Error parsing JSON in ${file}:`, e);
        }
      });
    }
  });
});
