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
          // Update files that have sceneRotation defined
          if (json.sceneRotation !== undefined && json.sceneRotation.y === 0) {
            json.sceneRotation.y = 180;
            const updatedJson = JSON.stringify(json, null, 2);
            
            fs.writeFile(filePath, updatedJson, (err) => {
              if (err) console.error(`Error writing file ${file}:`, err);
              else console.log(`Fixed ${file}: sceneRotation.y = 180`);
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
    }
  });
});
