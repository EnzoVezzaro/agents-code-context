const Dockerode = require('dockerode');
const { createHash, randomBytes } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);

class Sandbox {
  constructor(config) {
    this.docker = new Dockerode();
    this.config = config;
    this.container = null;
    this.state = {
      id: '',
      name: '',
      status: 'stopped',
    };
  }

  async start(snapshotDir, battleId) {
    const containerName = `aba-benchmark-${battleId}-${randomBytes(4).toString('hex')}`;
    
    await this.ensureImage();

    const container = await this.docker.createContainer({
      Image: this.config.image,
      name: containerName,
      Cmd: ['/bin/sh', '-c', 'mkdir -p /work'],
      Env: this.buildEnv(),
      NetworkingConfig: this.buildNetworkConfig(),
      HostConfig: this.buildHostConfig(),
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      ExposedPorts: {},
    });

    await container.start();
    this.container = container;
    this.state = { id: container.id, name: containerName, status: 'running' };

    await new Promise(r => setTimeout(r, 2000));

    await this.copySnapshotToContainer(container, snapshotDir);

    return {
      containerId: container.id,
      containerName,
      mountPath: '/work',
    };
  }

  buildEnv() {
    const env = [];
    
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        env.push(`${key}=${value}`);
      }
    }
    
    if (this.config.secrets) {
      for (const [key, value] of Object.entries(this.config.secrets)) {
        env.push(`${key}=***REDACTED***`);
      }
    }
    
    env.push(`ABA_NETWORK_POLICY=${this.config.network}`);
    
    return env;
  }

  buildNetworkConfig() {
    if (this.config.network === 'disabled') {
      return { EndpointID: '', NetworkMode: 'none' };
    } else if (this.config.network === 'restricted') {
      return { EndpointID: '', NetworkMode: 'default' };
    }
    return { EndpointID: '', NetworkMode: 'default' };
  }

  buildHostConfig() {
    return {
      Binds: [],
      Memory: this.config.memLimit ? this.parseMemory(this.config.memLimit) : undefined,
      CpuQuota: this.config.cpus ? this.config.cpus * 100000 : undefined,
      PidsLimit: 512,
    };
  }

  parseMemory(memLimit) {
    const match = memLimit.match(/^(\d+)(g|m|k)?$/i);
    if (!match) return 512 * 1024 * 1024;
    const value = parseInt(match[1], 10);
    const unit = (match[2] || '').toLowerCase();
    switch (unit) {
      case 'g': return value * 1024 * 1024;
      case 'm': return value * 1024 * 1024;
      case 'k': return Math.ceil(value * 1024);
      default: return value * 1024 * 1024;
    }
  }

  async ensureImage() {
    try {
      const image = this.config.image;
      await this.docker.getImage(image).pull();
    } catch (err) {
      throw new Error(`Failed to ensure image ${this.config.image}: ${err.message}`);
    }
  }

  async copySnapshotToContainer(container, snapshotDir) {
    const tar = await this.createSnapshotArchive(snapshotDir);
    await container.putArchive(tar);
    
    await container.exec({
      Cmd: ['/bin/sh', '-c', 'cd /work && tar -xzf - --strip-components=1'],
    }, {
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
    });
  }

  async createSnapshotArchive(snapshotDir) {
    return new Promise((resolve, reject) => {
      const tar = require('child_process').spawn('tar', ['czf', '-', '-C', snapshotDir, '.']);
      const chunks = [];
      tar.stdout.on('data', (data) => chunks.push(data));
      tar.stderr.on('data', (_data) => {});
      tar.on('close', () => resolve(Buffer.concat(chunks)));
      tar.on('error', reject);
    });
  }

  async stop(preserve) {
    if (!this.container) {
      return { exitCode: null, logs: '', artifacts: [] };
    }

    try {
      const logs = await this.container.logs({
        stdout: true,
        stderr: true,
        timestamps: false,
      });
      const logsStr = logs.toString();

      await this.container.stop();

      if (!preserve) {
        await this.container.remove({ force: true });
        this.state = { id: '', name: '', status: 'stopped' };
      } else {
        this.state = {
          id: this.container.id,
          name: this.container.name,
          status: 'stopped',
          finishedAt: new Date(),
        };
      }

      return {
        exitCode: this.container.Status ? parseInt(this.container.Status.Code, 10) : null,
        logs: logsStr,
        artifacts: [],
      };
    } catch (err) {
      this.state = { id: '', name: '', status: 'error' };
      throw err;
    }
  }

  getState() {
    return { ...this.state };
  }

  async exec(cmd) {
    if (!this.container) {
      throw new Error('No container running');
    }
    
    const result = await this.container.exec({
      Cmd: Array.isArray(cmd) ? cmd : [cmd],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: false,
    });
    
    const { stdout, stderr } = await result.start({
      AttachStdout: true,
      AttachStderr: true,
      Raw: true,
    });
    
    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: result.exitCode,
    };
  }

  async recordFingerprint() {
    if (!this.container) {
      throw new Error('No container running');
    }
    
    const containerInfo = await this.container.inspect();
    const os = containerInfo.Os || 'linux';
    const arch = containerInfo.Architecture || 'amd64';
    
    const digestMatch = (containerInfo.Config?.Image || '').match(/@sha256([a-f0-9]+)/);
    const digest = digestMatch ? digestMatch[1] : 'unknown';
    
    const versionResult = await this.exec('node --version');
    let runtimeVersion = 'unknown';
    if (versionResult.stdout) {
      const match = versionResult.stdout.match(/^v?(\d+\.\d+\.\d+)/m);
      if (match) {
        runtimeVersion = match[1];
      }
    }
    
    return {
      image: this.config.image,
      digest,
      os,
      arch,
      runtimeVersions: {
        [this.config.image]: runtimeVersion,
      },
    };
  }
}

module.exports = { Sandbox };