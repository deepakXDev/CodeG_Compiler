const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');


function executeCode(language, sourceFile, inputFile, outputFile, timeLimit, memoryLimit) {
  return new Promise((resolve) => {
        
    const outputExt = process.platform === 'win32' ? '.exe' : '.out';
    const exeFile = sourceFile.replace(path.extname(sourceFile), outputExt);
    
   if (language === 'c' || language === 'cpp') {
      const compiler = language === 'c' ? 'gcc' : 'g++';
      const compile = spawn(compiler, [sourceFile, '-o', exeFile]);
      let compileStderr = '';
      compile.stderr.on('data', (data) => { compileStderr += data; });

      compile.on('close', (code) => {
        if (code !== 0) {
          return resolve({ stdout: '', stderr: `Compilation Failed:\n${compileStderr}`, code });
        }
        if (process.platform !== 'win32') {
          fs.chmodSync(exeFile, 0o755);
        }
        runExecutable(exeFile, [], inputFile, outputFile, timeLimit, memoryLimit, resolve, [exeFile]);
      });

      compile.on('error', (err) => {
        resolve({ stdout: '', stderr: `Compiler (${compiler}) not found or failed to start: ${err.message}`, code: 1 });
      });

    } else if (language === 'java') {
      
      try {
        const sourceCode = fs.readFileSync(sourceFile, 'utf8');
        
        // SIMPLE FIX: Find the class name in the code to rename the file.
        // This ensures the .java filename matches the class name, which Java requires.
        const classNameMatch = sourceCode.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
        if (!classNameMatch || !classNameMatch[1]) {
          return resolve({ stdout: '', stderr: 'Could not find a class declaration in the Java source.', code: 1 });
        }
        
        const mainClassName = classNameMatch[1];
        const originalDir = path.dirname(sourceFile);
        const newSourcePath = path.join(originalDir, `${mainClassName}.java`);

        // Rename the original file (e.g., uuid.java -> Main.java)
        fs.renameSync(sourceFile, newSourcePath);
        sourceFile = newSourcePath; // Use the new, correctly named file from now on.

      } catch (err) {
        return resolve({ stdout: '', stderr: `Failed to preprocess Java file: ${err.message}`, code: 1 });
      }
      
      const compile = spawn('javac', [sourceFile]);
      let compileStderr = '';
      compile.stderr.on('data', (data) => { compileStderr += data; });

      compile.on('close', (code) => {
        if (code !== 0) {
          if (fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);
          return resolve({ stdout: '', stderr: `Compilation Failed:\n${compileStderr}`, code });
        }
        
        const className = path.basename(sourceFile, '.java');
        const classFileDir = path.dirname(sourceFile);

          const classFilePath = path.join(classFileDir, `${className}.class`);

        const javaCmd = 'java';
        const javaArgs = ['-cp', classFileDir, className];
        
        runExecutable(javaCmd, javaArgs, inputFile, outputFile, timeLimit, memoryLimit, resolve, [sourceFile, classFilePath]);
      });

      compile.on('error', (err) => {
        resolve({ stdout: '', stderr: `JDK not found or failed to start: ${err.message}`, code: 1 });
      });
    } else if (language === 'python' || language === 'py') {
      // CHANGE 2: Support 'py' as an alias for python.
      // CHANGE 3: Use 'python' on Windows and 'python3' on other systems.
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      runExecutable(pythonCmd, [sourceFile], inputFile, outputFile, timeLimit, memoryLimit, resolve);
    } else if (language === 'javascript') {
      runExecutable('node', [sourceFile], inputFile, outputFile, timeLimit, memoryLimit, resolve);
    } else {
      resolve({ stdout: '', stderr: `Unsupported language: ${language}`, code: 1 });
    }
  });
}


function runExecutable(command, args, inputFile, outputFile, timeLimit, memoryLimit, resolve, cleanupFiles = [], spawnOptions = {}) {
  let cmd, cmdArgs;
  const memoryLimitKB = memoryLimit * 1024; 

  if (process.platform === 'linux') {
    const commandAndArgs = [command, ...args];
    const escapedFullCommand = commandAndArgs.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
    
    cmd = '/bin/sh';
    cmdArgs = ['-c', `ulimit -v ${memoryLimitKB}; exec ${escapedFullCommand}`];
  } else {
    cmd = command;
    cmdArgs = args;
  }

  const child = spawn(cmd, cmdArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions 
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL'); 
  }, timeLimit);

  const inputStream = fs.createReadStream(inputFile);
  inputStream.pipe(child.stdin);

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });

    const cleanup = () => {
      cleanupFiles.forEach(file => {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  };

  child.on('error', (err) => {
    clearTimeout(timeout);
    cleanup();
    return resolve({ stdout: '', stderr: `Execution failed to start: ${err.message}`, code: 1 });
  });

  child.on('close', (code, signal) => {
    clearTimeout(timeout);
    cleanup();

    if (timedOut) {
      return resolve({ stdout, stderr: 'Time Limit Exceeded', code: -1, signal: 'SIGKILL' });
    }
    
    if (signal === 'SIGKILL' || (stderr.includes('MemoryError') || stderr.includes('killed'))) {
       return resolve({ stdout, stderr: 'Memory Limit Exceeded', code: -1, signal });
    }

    try {
      fs.writeFileSync(outputFile, stdout);
      resolve({ stdout, stderr, code, signal });
    } catch (writeErr) {
      resolve({ stdout, stderr: `Output file write error: ${writeErr.message}`, code: -1 });
    }
  });
}

module.exports = { executeCode };