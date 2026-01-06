#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const readline = require("readline");

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    source: null,
    completed: null,
    delay: 60,
    batchSize: 20,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && i + 1 < args.length) {
      config.source = args[++i];
    } else if (args[i] === "--completed" && i + 1 < args.length) {
      config.completed = args[++i];
    } else if (args[i] === "--delay" && i + 1 < args.length) {
      config.delay = parseInt(args[++i], 10);
    } else if (args[i] === "--batch-size" && i + 1 < args.length) {
      config.batchSize = parseInt(args[++i], 10);
    }
  }

  if (!config.source) {
    console.error("Error: --source directory is required");
    console.error("Usage: node import-to-notes.js --source <dir> [--completed <dir>] [--delay <seconds>] [--batch-size <number>]");
    process.exit(1);
  }

  // Set default completed directory if not provided
  if (!config.completed) {
    const sourceDir = path.resolve(config.source);
    config.completed = path.join(path.dirname(sourceDir), "completed");
  }

  return config;
}

// Recursively collect all files from directory
function collectFiles(dir, baseDir = null) {
  if (!baseDir) baseDir = dir;
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files and directories (starting with .)
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath),
        name: entry.name,
      });
    }
  }

  return files;
}

// Execute AppleScript file with arguments
function runAppleScriptFile(scriptFile, args) {
  try {
    const scriptPath = path.join(__dirname, scriptFile);
    // Use spawnSync with proper argument handling to avoid shell escaping issues
    const result = spawnSync("osascript", [scriptPath, ...args], {
      stdio: "pipe",
      encoding: "utf8",
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    if (result.status !== 0) {
      const errorMsg = result.stderr || result.stdout || "Unknown error";
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create folder structure in Apple Notes
function createFolder(folderPath) {
  const folders = folderPath.split("/").filter((f) => f.length > 0);
  if (folders.length === 0) return { success: true };

  return runAppleScriptFile("create-folder.applescript", [folderPath]);
}

// Create note with attachment in Apple Notes
function createNoteWithAttachment(noteTitle, filePath, folderPath) {
  // Use empty string if folderPath is "." (root)
  const folderPathArg = folderPath === "." ? "" : folderPath;
  return runAppleScriptFile("create-note.applescript", [noteTitle, filePath, folderPathArg]);
}

// Sleep utility
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// Move file to completed directory preserving structure
function moveToCompleted(file, sourceDir, completedDir) {
  const completedPath = path.join(completedDir, file.relativePath);
  const completedFileDir = path.dirname(completedPath);

  // Create directory structure in completed folder
  fs.mkdirSync(completedFileDir, { recursive: true });

  // Move the file
  fs.renameSync(file.fullPath, completedPath);
}

// Prompt user to continue
function promptContinue() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("\nBatch complete. Press Enter to continue or Ctrl+C to quit: ", () => {
      rl.close();
      resolve();
    });
  });
}

// Format time
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

// Main processing function
async function main() {
  const config = parseArgs();

  // Resolve paths
  const sourceDir = path.resolve(config.source);
  const completedDir = path.resolve(config.completed);

  // Validate source directory
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  // Create completed directory if it doesn't exist
  fs.mkdirSync(completedDir, { recursive: true });

  console.log(`Source directory: ${sourceDir}`);
  console.log(`Completed directory: ${completedDir}`);
  console.log(`Delay between files: ${config.delay} seconds`);
  console.log(`Batch size: ${config.batchSize} files\n`);

  // Collect all files
  console.log("Collecting files...");
  const allFiles = collectFiles(sourceDir);
  console.log(`Found ${allFiles.length} files to process\n`);

  if (allFiles.length === 0) {
    console.log("No files to process. Exiting.");
    return;
  }

  let processedCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  // Process files in batches
  for (let batchStart = 0; batchStart < allFiles.length; batchStart += config.batchSize) {
    const batchEnd = Math.min(batchStart + config.batchSize, allFiles.length);
    const batch = allFiles.slice(batchStart, batchEnd);
    const batchNumber = Math.floor(batchStart / config.batchSize) + 1;
    const totalBatches = Math.ceil(allFiles.length / config.batchSize);

    console.log(`\n=== Batch ${batchNumber}/${totalBatches} ===`);
    const batchStartTime = Date.now();

    for (let i = 0; i < batch.length; i++) {
      const file = batch[i];
      const fileNumber = batchStart + i + 1;
      const relativeDir = path.dirname(file.relativePath);

      console.log(`[${fileNumber}/${allFiles.length}] Processing: ${file.relativePath}`);
      console.log(`  Folder path: "${relativeDir}"`);

      try {
        // Create folder structure if needed
        if (relativeDir !== ".") {
          const folderResult = createFolder(relativeDir);
          if (!folderResult.success) {
            throw new Error(`Failed to create folder "${relativeDir}": ${folderResult.error}`);
          }
          // Small delay to ensure folder is available
          await sleep(1);
        }

        // Create note with attachment
        const noteResult = createNoteWithAttachment(file.name, file.fullPath, relativeDir);
        if (!noteResult.success) {
          throw new Error(`Failed to create note: ${noteResult.error}`);
        }

        // Wait for delay (except after last file in batch)
        if (i < batch.length - 1) {
          process.stdout.write(`  Waiting ${config.delay} seconds...`);
          await sleep(config.delay);
          console.log(" done");
        } else {
          // Small delay even for last file to ensure it's processed
          await sleep(2);
        }

        // Move file to completed directory
        moveToCompleted(file, sourceDir, completedDir);
        processedCount++;
        console.log(`  ✓ Successfully imported and moved to completed`);

      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error: ${error.message}`);
        // Continue with next file
      }
    }

    const batchElapsed = Math.floor((Date.now() - batchStartTime) / 1000);
    const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = allFiles.length - processedCount - errorCount;

    console.log(`\nBatch ${batchNumber} complete:`);
    console.log(`  Files processed in this batch: ${batch.length}`);
    console.log(`  Total processed: ${processedCount}`);
    console.log(`  Total errors: ${errorCount}`);
    console.log(`  Remaining: ${remaining}`);
    console.log(`  Batch time: ${formatTime(batchElapsed)}`);
    console.log(`  Total time: ${formatTime(totalElapsed)}`);

    // Prompt to continue if there are more files
    if (batchEnd < allFiles.length) {
      await promptContinue();
    }
  }

  const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n=== Import Complete ===`);
  console.log(`Total files processed: ${processedCount}`);
  console.log(`Total errors: ${errorCount}`);
  console.log(`Total time: ${formatTime(totalElapsed)}`);
}

// Run main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

