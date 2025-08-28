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
        runExecutable(exeFile, [], inputFile, outputFile, timeLimit, memoryLimit, resolve, exeFile);
      });

      compile.on('error', (err) => {
        resolve({ stdout: '', stderr: `Compiler (${compiler}) not found or failed to start: ${err.message}`, code: 1 });
      });

    } else if (language === 'java') {
      
      const compile = spawn('javac', [sourceFile]);
      let compileStderr = '';
      compile.stderr.on('data', (data) => { compileStderr += data; });

      compile.on('close', (code) => {
        if (code !== 0) {
          return resolve({ stdout: '', stderr: `Compilation Failed:\n${compileStderr}`, code });
        }
        
        const className = path.basename(sourceFile, '.java');
        const classFileDir = path.dirname(sourceFile);
        
        const javaCmd = `java -cp ${classFileDir} ${className}`;
        runExecutable(javaCmd, [], inputFile, outputFile, timeLimit, memoryLimit, resolve, `${classFileDir}/${className}.class`);
      });

       compile.on('error', (err) => {
        resolve({ stdout: '', stderr: `JDK not found or failed to start: ${err.message}`, code: 1 });
      });

    } else if (language === 'python') {
      runExecutable('python3', [sourceFile], inputFile, outputFile, timeLimit, memoryLimit, resolve);
    } else if (language === 'javascript') {
      runExecutable('node', [sourceFile], inputFile, outputFile, timeLimit, memoryLimit, resolve);
    } else {
      resolve({ stdout: '', stderr: `Unsupported language: ${language}`, code: 1 });
    }
  });
}


function runExecutable(command, args, inputFile, outputFile, timeLimit, memoryLimit, resolve, cleanupFile = null) {
  // CHANGE 2: Use shell commands for resource limiting (ulimit on Linux)
  let cmd, cmdArgs;
  const memoryLimitKB = memoryLimit * 1024; 

  if (process.platform === 'linux') {
    const fullCommand = [command, ...args].join(' ');
    cmd = '/bin/sh';
    cmdArgs = ['-c', `ulimit -v ${memoryLimitKB} && ${fullCommand}`];
  } else {
    
    cmd = command;
    cmdArgs = args;
  }

  const child = spawn(cmd, cmdArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'linux', 
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

  // CHANGE 3: Add a proper 'error' handler to catch ENOENT and other spawn errors
  child.on('error', (err) => {
    clearTimeout(timeout);
    if (cleanupFile && fs.existsSync(cleanupFile)) fs.unlinkSync(cleanupFile);
    return resolve({ stdout: '', stderr: `Execution failed to start: ${err.message}`, code: 1 });
  });

  child.on('close', (code, signal) => {
    clearTimeout(timeout);
    if (cleanupFile && fs.existsSync(cleanupFile)) fs.unlinkSync(cleanupFile);

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