use libtor::{Tor, TorBool, TorFlag};
use std::{
    env, fs, io,
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const DEFAULT_SOCKS_PORT: u16 = 9050;
const DEFAULT_CONTROL_PORT: u16 = 9051;
const READINESS_TIMEOUT_SECS: u64 = 45;

#[derive(Debug, Clone)]
struct Config {
    socks_port: u16,
    control_port: u16,
    config_dir: PathBuf,
}

#[derive(Debug, Clone, Copy)]
enum Source {
    System,
    Host,
    Embedded,
    None,
}

impl Source {
    fn as_str(self) -> &'static str {
        match self {
            Source::System => "system",
            Source::Host => "host",
            Source::Embedded => "embedded",
            Source::None => "none",
        }
    }

    fn managed(self) -> bool {
        matches!(self, Source::Host | Source::Embedded)
    }
}

fn main() {
    let config = Config::from_env();

    if let Err(error) = fs::create_dir_all(&config.config_dir) {
        eprintln!(
            "[tor-manager] Could not create config dir {}: {}",
            config.config_dir.display(),
            error
        );
    }

    println!(
        "[tor-manager] Ensuring Tor on SOCKS 127.0.0.1:{} and control 127.0.0.1:{}",
        config.socks_port, config.control_port
    );

    if tor_ports_reachable(&config) {
        println!("[tor-manager] Using already-running system Tor");
        write_status(&config, Source::System);
        return;
    }

    if let Some(tor_bin) = find_host_tor() {
        match start_host_tor(&config, &tor_bin) {
            Ok(mut child) => {
                println!("[tor-manager] Started host Tor from {}", tor_bin.display());
                write_status(&config, Source::Host);
                wait_for_child(&mut child);
                return;
            }
            Err(error) => {
                eprintln!(
                    "[tor-manager] Host Tor found at {}, but startup failed: {}",
                    tor_bin.display(),
                    error
                );
            }
        }
    } else {
        println!("[tor-manager] No host tor binary found");
    }

    match start_embedded_tor(&config) {
        Ok(()) => {
            write_status(&config, Source::Embedded);
            println!("[tor-manager] Embedded Tor is running");
            loop {
                thread::sleep(Duration::from_secs(60));
            }
        }
        Err(error) => {
            eprintln!("[tor-manager] Embedded Tor startup failed: {}", error);
            write_status(&config, Source::None);
            println!("[tor-manager] Continuing without managed Tor");
        }
    }
}

impl Config {
    fn from_env() -> Self {
        Self {
            socks_port: env_u16("COINSWAP_TOR_SOCKS_PORT", DEFAULT_SOCKS_PORT),
            control_port: env_u16("COINSWAP_TOR_CONTROL_PORT", DEFAULT_CONTROL_PORT),
            config_dir: env::var_os("COINSWAP_TOR_CONFIG_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(default_config_dir),
        }
    }

    fn tor_dir(&self) -> PathBuf {
        self.config_dir.join("tor")
    }

    fn tor_data_dir(&self) -> PathBuf {
        self.tor_dir().join("data")
    }

    fn torrc_path(&self) -> PathBuf {
        self.tor_dir().join("torrc")
    }

    fn status_path(&self) -> PathBuf {
        self.config_dir.join("tor-status.json")
    }
}

fn env_u16(name: &str, default: u16) -> u16 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(default)
}

fn default_config_dir() -> PathBuf {
    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home)
            .join(".coinswap")
            .join("taker")
            .join("tor-manager");
    }

    env::temp_dir().join("coinswap-taker").join("tor-manager")
}

fn tor_ports_reachable(config: &Config) -> bool {
    tcp_reachable(config.socks_port) && tcp_reachable(config.control_port)
}

fn tcp_reachable(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(700)).is_ok()
}

fn find_host_tor() -> Option<PathBuf> {
    let lookup_cmd = if cfg!(windows) { "where" } else { "which" };
    if let Ok(output) = Command::new(lookup_cmd).arg("tor").output() {
        if output.status.success() {
            if let Some(first_line) = String::from_utf8_lossy(&output.stdout).lines().next() {
                let candidate = PathBuf::from(first_line.trim());
                if executable_file(&candidate) {
                    return Some(candidate);
                }
            }
        }
    }

    common_tor_paths()
        .into_iter()
        .map(PathBuf::from)
        .find(|candidate| executable_file(candidate))
}

fn common_tor_paths() -> Vec<&'static str> {
    if cfg!(target_os = "macos") {
        vec![
            "/opt/homebrew/bin/tor",
            "/usr/local/bin/tor",
            "/usr/bin/tor",
            "/opt/local/bin/tor",
        ]
    } else if cfg!(windows) {
        vec![
            "C:\\Program Files\\Tor\\tor.exe",
            "C:\\Program Files (x86)\\Tor\\tor.exe",
        ]
    } else {
        vec!["/usr/bin/tor", "/usr/local/bin/tor", "/bin/tor"]
    }
}

fn executable_file(path: &Path) -> bool {
    path.is_file()
}

fn start_host_tor(config: &Config, tor_bin: &Path) -> io::Result<Child> {
    write_torrc(config)?;

    let mut child = Command::new(tor_bin)
        .arg("-f")
        .arg(config.torrc_path())
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;

    if wait_until_ready(config, Duration::from_secs(READINESS_TIMEOUT_SECS)) {
        Ok(child)
    } else {
        let _ = child.kill();
        let _ = child.wait();
        Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "Tor did not open SOCKS/control ports in time",
        ))
    }
}

fn write_torrc(config: &Config) -> io::Result<()> {
    fs::create_dir_all(config.tor_data_dir())?;
    let data_dir = torrc_quoted_path(&config.tor_data_dir());
    let torrc = format!(
        "SocksPort 127.0.0.1:{}\nControlPort 127.0.0.1:{}\nCookieAuthentication 0\nDataDirectory \"{}\"\n",
        config.socks_port,
        config.control_port,
        data_dir
    );
    fs::write(config.torrc_path(), torrc)
}

fn torrc_quoted_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
}

fn wait_for_child(child: &mut Child) {
    match child.wait() {
        Ok(status) => println!("[tor-manager] Host Tor exited with {}", status),
        Err(error) => eprintln!("[tor-manager] Failed waiting for host Tor: {}", error),
    }
}

fn start_embedded_tor(config: &Config) -> Result<(), String> {
    fs::create_dir_all(config.tor_data_dir()).map_err(|error| error.to_string())?;

    let mut tor = Tor::new();
    tor.flag(TorFlag::DataDirectory(
        config.tor_data_dir().to_string_lossy().to_string(),
    ))
    .flag(TorFlag::SocksPort(config.socks_port))
    .flag(TorFlag::ControlPort(config.control_port))
    .flag(TorFlag::CookieAuthentication(TorBool::from(false)))
    .flag(TorFlag::Hush());

    let handle = tor.start_background();

    if wait_until_ready(config, Duration::from_secs(READINESS_TIMEOUT_SECS)) {
        thread::spawn(move || match handle.join() {
            Ok(Ok(code)) => eprintln!("[tor-manager] Embedded Tor exited with code {}", code),
            Ok(Err(error)) => eprintln!("[tor-manager] Embedded Tor error: {:?}", error),
            Err(_) => eprintln!("[tor-manager] Embedded Tor thread panicked"),
        });
        Ok(())
    } else {
        Err("embedded Tor did not open SOCKS/control ports in time".to_string())
    }
}

fn wait_until_ready(config: &Config, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if tor_ports_reachable(config) {
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}

fn write_status(config: &Config, source: Source) {
    let status = format!(
        "{{\n  \"source\": \"{}\",\n  \"managed\": {},\n  \"socksPort\": {},\n  \"controlPort\": {}\n}}\n",
        source.as_str(),
        source.managed(),
        config.socks_port,
        config.control_port
    );

    if let Err(error) = fs::write(config.status_path(), status) {
        eprintln!(
            "[tor-manager] Could not write status file {}: {}",
            config.status_path().display(),
            error
        );
    }
}
