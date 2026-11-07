"""Read-only Linux inventory. Executed in memory through SSH; never installs software."""
import json
import os
import re
import shutil
import subprocess
import time
import urllib.request


def run(args, timeout=5):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.stdout if p.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def read(path, default=""):
    try:
        with open(path) as f:
            return f.read(262144)
    except OSError:
        return default


def cpu():
    values = [int(v) for v in read('/proc/stat').splitlines()[0].split()[1:]]
    return sum(values[:8]), values[3] + values[4]


def process_sample():
    result = {}
    for pid in os.listdir('/proc'):
        if not pid.isdigit():
            continue
        raw = read('/proc/' + pid + '/stat')
        if not raw:
            continue
        try:
            tail = raw[raw.rfind(')') + 2:].split()
            name = raw[raw.find('(') + 1:raw.rfind(')')]
            cwd = os.readlink('/proc/' + pid + '/cwd')
            cgroup = read('/proc/' + pid + '/cgroup')
            result[pid] = dict(pid=int(pid), name=name, cwd=cwd,
                ticks=int(tail[11]) + int(tail[12]),
                memoryBytes=max(0, int(tail[21])) * os.sysconf('SC_PAGE_SIZE'),
                container=bool(re.search(r'docker|kubepods|containerd', cgroup)))
        except (OSError, ValueError, IndexError):
            continue
    return result


def systemd_sample(listeners, existing):
    """Add services whose /proc entries are hidden from a non-root SSH account.

    Hardened services often run as a dedicated user and hide their cwd from
    the inventory account. systemd still exposes the unit's main PID and
    working directory, which is enough to associate the deployment without
    reading credentials or service environments.
    """
    output = run(['systemctl', 'list-units', '--type=service', '--state=running',
                  '--no-legend', '--no-pager'], 5)
    if not output:
        return []
    result = []
    for line in output.splitlines()[:200]:
        unit = line.split(None, 1)[0] if line.split(None, 1) else ''
        if not unit.endswith('.service'):
            continue
        details = run(['systemctl', 'show', unit, '--property=MainPID,WorkingDirectory,ExecStart'], 5)
        values = dict(item.split('=', 1) for item in (details or '').splitlines() if '=' in item)
        try:
            pid = int(values.get('MainPID', '0'))
        except ValueError:
            continue
        cwd = values.get('WorkingDirectory', '')
        if not cwd and re.search(r'learn|app|api|web|node|python|uvicorn|gunicorn', unit, re.I):
            paths = [value.rstrip(';') for value in re.findall(r'(/[^{\s}]+)', values.get('ExecStart', ''))]
            script_paths = [value for value in paths if re.search(r'\.(?:mjs|cjs|js|py)$', value)]
            if script_paths:
                cwd = os.path.dirname(script_paths[-1])
        if pid <= 0 or not cwd or cwd in {'/', '/proc'} or pid in existing:
            continue
        stat = read(f'/proc/{pid}/stat')
        memory = 0
        try:
            tail = stat[stat.rfind(')') + 2:].split()
            memory = max(0, int(tail[21])) * os.sysconf('SC_PAGE_SIZE')
        except (ValueError, IndexError):
            pass
        result.append(dict(
            pid=pid,
            name=unit[:-8],
            cwd=cwd,
            ticks=0,
            memoryBytes=memory,
            ports=sorted(set(row['port'] for row in listeners if pid in row['pids'])),
            cpuPercent=None,
        ))
    return result


def blocks(text, keyword):
    for match in re.finditer(r'\b' + keyword + r'\s*\{', text):
        start, depth, pos = match.end(), 1, match.end()
        while pos < len(text) and depth:
            if text[pos] == '{':
                depth += 1
            elif text[pos] == '}':
                depth -= 1
            pos += 1
        if depth == 0:
            yield text[start:pos - 1]


def nginx_sites():
    output = run(['nginx', '-T'], 7)
    source = 'nginx -T'
    if output is None:
        source = '可读的 Nginx 配置'
        paths = ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d', '/www/server/panel/vhost/nginx']
        parts = []
        for directory in paths:
            if os.path.isdir(directory):
                for filename in os.listdir(directory)[:100]:
                    parts.append(read(os.path.join(directory, filename)))
        output = '\n'.join(parts)
    output = re.sub(r'#.*', '', output or '')
    sites = []
    for block in blocks(output, 'server'):
        domains = []
        for group in re.findall(r'\bserver_name\s+([^;]+);', block):
            domains.extend(d for d in group.split() if re.fullmatch(r'[a-zA-Z0-9*][a-zA-Z0-9.*-]*\.[a-zA-Z]{2,}', d))
        ports = re.findall(r'\blisten\s+([^;]+);', block)
        tls = any('ssl' in port or '443' in port for port in ports)
        proxies = re.findall(r'\bproxy_pass\s+(https?://[^\s;]+)', block)
        proxies = [re.sub(r'//[^/@]+@', '//', p) for p in proxies]
        roots = re.findall(r'\broot\s+([^;]+);', block)
        if domains:
            sites.append(dict(domains=list(dict.fromkeys(domains)), tls=tls,
                upstreams=list(dict.fromkeys(proxies)), root=roots[0].strip() if roots else None,
                source=source))
    return sites


def meta(path, base):
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(base + path, timeout=0.5) as response:
            value = response.read(256).decode().strip()
            return value if value and '<' not in value else None
    except Exception:
        return None


def collect():
    started = time.time()
    total0, idle0 = cpu()
    ps0 = process_sample()
    time.sleep(0.35)
    total1, idle1 = cpu()
    ps1 = process_sample()
    delta = max(1, total1 - total0)
    memory = {k: int(v) * 1024 for k, v in re.findall(r'^(\w+):\s+(\d+)\s+kB', read('/proc/meminfo'), re.M)}
    os_release = dict(re.findall(r'^(\w+)="?([^"\n]*)"?$', read('/etc/os-release'), re.M))
    disk = shutil.disk_usage('/')
    ss = run(['ss', '-ltnpH'])
    listeners = []
    for line in (ss or '').splitlines():
        columns = line.split()
        if len(columns) >= 4:
            address = columns[3]
            port = address.rsplit(':', 1)[-1]
            if port.isdigit():
                listeners.append(dict(port=int(port), address=address,
                    pids=[int(v) for v in re.findall(r'pid=(\d+)', line)]))
    processes = []
    runtimes = re.compile(r'node|python|gunicorn|uvicorn|java|php|dotnet|bun|deno|next-server|npm|hugo|caddy', re.I)
    for pid, p in ps1.items():
        if int(pid) == os.getpid() or p['container'] or not runtimes.search(p['name']) or p['cwd'] in ['/', '/proc']:
            continue
        before = ps0.get(pid)
        p['cpuPercent'] = round(max(0, p['ticks'] - before['ticks']) / delta * 100, 2) if before else None
        p['ports'] = sorted(set(row['port'] for row in listeners if p['pid'] in row['pids']))
        p.pop('ticks', None)
        p.pop('container', None)
        processes.append(p)
    processes.extend(systemd_sample(listeners, {item['pid'] for item in processes}))
    docker_ps = run(['docker', 'ps', '--format', '{{json .}}'], 6)
    containers = []
    if docker_ps is not None:
        stats_text = run(['docker', 'stats', '--no-stream', '--format', '{{json .}}'], 8)
        stats = {}
        for line in (stats_text or '').splitlines():
            try:
                row = json.loads(line)
                stats[row.get('Name')] = row
            except ValueError:
                pass
        units = {'B': 1, 'kB': 1000, 'MB': 1000**2, 'GB': 1000**3,
                 'KiB': 1024, 'MiB': 1024**2, 'GiB': 1024**3}
        for line in docker_ps.splitlines()[:100]:
            try:
                row = json.loads(line)
                labels_raw = run(['docker', 'inspect', '--format', '{{json .Config.Labels}}', row['ID']])
                labels = json.loads(labels_raw or '{}') or {}
                stat = stats.get(row['Names'], {})
                usage = re.match(r'([\d.]+)(\w+)', stat.get('MemUsage', '').replace(' ', ''))
                containers.append(dict(id=row['ID'], name=row['Names'], image=row['Image'],
                    status=row['State'], ports=row['Ports'],
                    project=labels.get('com.docker.compose.project'),
                    service=labels.get('com.docker.compose.service'),
                    cwd=labels.get('com.docker.compose.project.working_dir'),
                    cpuPercent=round(float(stat['CPUPerc'].strip('%')) / (os.cpu_count() or 1), 2) if stat.get('CPUPerc') else None,
                    memoryBytes=round(float(usage.group(1)) * units.get(usage.group(2), 1)) if usage else None))
            except (ValueError, KeyError):
                continue
    vendor_raw = read('/sys/class/dmi/id/sys_vendor').strip()
    product_raw = read('/sys/class/dmi/id/product_name').strip()
    vendor = '阿里云' if 'alibaba' in (vendor_raw + product_raw).lower() else '腾讯云' if 'tencent' in (vendor_raw + product_raw).lower() else None
    region = instance_id = None
    if vendor == '阿里云':
        base = 'http://100.100.100.200/latest/meta-data/'
        region, instance_id = meta('region-id', base), meta('instance-id', base)
    elif vendor == '腾讯云':
        base = 'http://metadata.tencentyun.com/latest/meta-data/'
        region, instance_id = meta('placement/region', base), meta('instance-id', base)
    return dict(collectedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        durationMs=round((time.time() - started) * 1000),
        hostname=os.uname().nodename, os=os_release.get('PRETTY_NAME', os.uname().sysname),
        kernel=os.uname().release, cpuModel=next(iter(re.findall(r'^model name\s*:\s*(.+)', read('/proc/cpuinfo'), re.M)), None),
        cpuCores=os.cpu_count(), cpuPercent=round(max(0, 1 - (idle1 - idle0) / delta) * 100, 2),
        memoryTotal=memory.get('MemTotal'), memoryUsed=memory.get('MemTotal', 0) - memory.get('MemAvailable', memory.get('MemFree', 0)),
        diskTotal=disk.total, diskUsed=disk.used, uptimeSeconds=int(float(read('/proc/uptime', '0').split()[0])),
        provider=vendor, region=region, instanceId=instance_id,
        processes=processes, containers=containers, sites=nginx_sites(),
        listeners=list({row['port']: row for row in listeners}.values()),
        capabilities=dict(docker=docker_ps is not None, sockets=ss is not None, privileged=os.geteuid() == 0),
        metricMethod='CPU: /proc/stat 双采样；内存: MemTotal - MemAvailable；容器: docker stats；进程: RSS')


try:
    print(json.dumps(collect(), ensure_ascii=False))
except Exception as error:
    print(json.dumps({'error': type(error).__name__ + ': 采集未完成'}))
