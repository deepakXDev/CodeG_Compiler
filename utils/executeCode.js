const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

function executeCode(language, sourceFile, inputFile, outputFile, timeLimit, memoryLimit) {
  return new Promise((resolve) => {
    const ext = path.extname(sourceFile);

    const outputExt = process.platform === 'win32' ? '.exe' : '.out';
    const exeFile = sourceFile.replace(ext, outputExt);

    let compileCmd = null;
    if (language === 'cpp') {
      // Compilation step
      compileCmd = spawn('g++', [sourceFile, '-o', exeFile], {
        shell: true
      });
      
      //Fix: Add proper error handling for compilation:
      let compileStderr = '';
  compileCmd.stderr.on('data', (data) => {
    compileStderr += data.toString();
  });

  compileCmd.on('error', (error) => {
    return resolve({
      stdout: '',
      stderr: `Compilation error: ${error.message}`,
      code: 1,
    });
  });


      compileCmd.on('close', (code) => {
        if (code !== 0) {
          return resolve({
            stdout: '',
            stderr: `Compilation failed with code ${code}`,
            code: 1,
          });
        }

        // Execution step
        // const runCmd = process.platform === 'win32' ? exeFile : `./${path.basename(exeFile)}`;
        //Above -->Error: as exeFile is not./, it is at "tempFolder".. (Keep full filePath)

        const runCmd = exeFile;  // works for both Linux and Windows


        // runExecutable(runCmd, inputFile, outputFile, timeLimit, resolve);
        
        // runExecutable(runCmd, inputFile, outputFile, timeLimit, (result) => {
        // // ✅ cleanup here, after runExecutable finished
        //   if (fs.existsSync(exeFile)) {
        //     try { fs.unlinkSync(exeFile); } catch (e) { console.error("cleanup failed", e); }
        //   }
        //   resolve(result); // <-- settle the outer Promise
        // });

         // ✅ Pass exeFile as cleanup target
      runExecutable(runCmd, inputFile, outputFile, timeLimit, resolve, [], exeFile)

      });
    } else if (language === 'python') {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      runExecutable(pythonCmd, inputFile, outputFile, timeLimit, resolve, [sourceFile]); //python3->linux
    } else if (language === 'javascript') {
      runExecutable('node', inputFile, outputFile, timeLimit, resolve, [sourceFile]);
    } 
    //also java->javac Main.java && then java Main..to compile & run..
    else {
      return resolve({ stdout: '', stderr: 'Unsupported language', code: 1 });
    }
  });
}

function runExecutable(cmd, inputFile, outputFile, timeLimit, resolve, args = [],cleanupFile = null) {
  const process = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    // process.kill();
    process.kill('SIGKILL');
  }, timeLimit);

  // const input = fs.readFileSync(inputFile);
  // process.stdin.write(input);
  // process.stdin.end();

 // Handle stdin writing with proper error handling
  try {
    const input = fs.readFileSync(inputFile);
    process.stdin.write(input);
    process.stdin.end();
  } catch (error) {
    console.error('Error writing to stdin:', error);
    process.kill();
    clearTimeout(timeout);
    return resolve({ stdout: '', stderr: 'Input error', code: -1 });
  }

  let stdout = '';
  let stderr = '';

  process.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  process.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  process.on('close', (code) => {
    clearTimeout(timeout);

    // ✅ Cleanup compiled executable if provided
    if (cleanupFile && fs.existsSync(cleanupFile)) {
      try {
        fs.unlinkSync(cleanupFile);
      } catch (err) {
        console.error("Cleanup failed:", err);
      }
    }


    if (timedOut) {
      return resolve({ stdout: '', stderr: 'Time Limit Exceeded', code: -1 });
    }
    // fs.writeFileSync(outputFile, stdout);
    // resolve({ stdout, stderr, code });

     try {
      fs.writeFileSync(outputFile, stdout);
      resolve({ stdout, stderr, code });
    } catch (error) {
      console.error('Error writing output file:', error);
      resolve({ stdout, stderr: `Output file error: ${error.message}`, code: -1 });
    }
  });
}

module.exports = executeCode;
