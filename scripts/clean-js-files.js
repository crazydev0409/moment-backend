/**
 * Script to remove JavaScript files from src directory
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../src');

// Function to recursively find files
function findJsFiles(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      filelist = findJsFiles(filePath, filelist);
    } else {
      if (file.endsWith('.js') || file.endsWith('.js.map')) {
        filelist.push(filePath);
      }
    }
  });
  
  return filelist;
}

// Find and delete JS files
try {
  const jsFiles = findJsFiles(sourceDir);
  console.log(`Found ${jsFiles.length} JavaScript files to delete`);
  
  jsFiles.forEach(file => {
    fs.unlinkSync(file);
    console.log(`Deleted: ${file}`);
  });
  
  console.log('Cleanup complete!');
} catch (error) {
  console.error('Error during cleanup:', error);
  process.exit(1);
} 