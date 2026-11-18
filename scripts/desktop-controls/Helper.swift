import AppKit
import Carbon

// Registered combinations only: no event tap, accessibility API or clipboard access.
struct NativeShortcut: Decodable { let action: UInt32; let key: String; let modifiers: [String] }
struct NativeShortcutPolicy: Decodable { let scope: String; let combos: [NativeShortcut] }
final class Controls: NSObject, NSApplicationDelegate {
    var toast: NSPanel?
    var toastTimer: Timer?
    var heartbeatTimer: Timer?
    var heartbeatBusy = false
    var item: NSStatusItem!
    var refs: [EventHotKeyRef] = []
    var window: NSWindow!
    var picker: NSPopUpButton!
    var message: NSTextField!
    var create: NSButton!
    var chats: [[String: Any]] = []
    var enabled = false
    var busy = false
    var settingStatus = false
    var registrationError = ""
    var registrationStatuses: [Int32] = []
    var attemptedGlobalRegistration = false
    var policy: NativeShortcutPolicy? { config["shortcutPolicy"].flatMap { $0.data(using: .utf8) }.flatMap { try? JSONDecoder().decode(NativeShortcutPolicy.self, from: $0) } }
    var shortcutStatus: NSTextField?
    let config = (NSDictionary(contentsOfFile: Bundle.main.path(forResource: "Bridge", ofType: "plist")!) as? [String: String]) ?? [:]
    func applicationDidFinishLaunching(_ note: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "LH"
        let menu = NSMenu()
        for (title, action) in [("Turn learning on", #selector(on)), ("Turn learning off", #selector(off)), ("New learning moment…", #selector(choose)), ("Quit LearningHarness controls", #selector(quit))] {
            let label = title == "Quit LearningHarness controls" ? title : "\(config["hostName"] ?? "") — \(title)"
            let entry = NSMenuItem(title: label, action: action, keyEquivalent: "")
            if let spec = policy?.combos.first(where: { $0.action == UInt32(menu.items.count + 1) }) {
                entry.keyEquivalent = spec.key
                entry.keyEquivalentModifierMask = spec.modifiers.reduce(into: NSEvent.ModifierFlags()) { flags, modifier in
                    if modifier == "control" { flags.insert(.control) }; if modifier == "option" { flags.insert(.option) }; if modifier == "command" { flags.insert(.command) }; if modifier == "shift" { flags.insert(.shift) }
                }
            }
            entry.target = self; menu.addItem(entry)
        }
        item.menu = menu
        let main = NSMenu(), application = NSMenuItem(), actions = NSMenu()
        main.addItem(application); application.submenu = actions
        for entry in menu.items { actions.addItem(entry.copy() as! NSMenuItem) }
        actions.items.last?.keyEquivalent = "q"
        NSApp.mainMenu = main
        InstallEventHandler(GetApplicationEventTarget(), { _, event, _ in
            var id = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
            DispatchQueue.main.async { if id.id == 1 { controls.on() }; if id.id == 2 { controls.off() }; if id.id == 3 { controls.choose() } }
            return noErr
        }, 1, [EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))], nil, nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(active), name: NSWorkspace.didActivateApplicationNotification, object: nil)
        active()
        heartbeat()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.heartbeat() }
        if config["testMode"] == "1" { choose() }
        else if config["diagnostics"] == "1" { show("Synthetic shortcut acceptance. Global Claude keys: Control Option Command L / O / M. Test with Learn closed or another app active; inspect registration.json in the fixture directory."); picker.isHidden = true; create.isHidden = true }
    }
    @objc func active() {
        let global = self.policy?.scope == "global"
        if !global { refs.forEach { UnregisterEventHotKey($0) }; refs = [] }
        let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""

        defer {
            if config["diagnostics"] == "1", let directory = config["dataDirectory"], let data = try? JSONSerialization.data(withJSONObject: ["frontmostBundle": front, "configuredBundle": config["bundle"] ?? "", "registered": refs.count, "statuses": registrationStatuses, "scope": self.policy?.scope ?? "unconfigured", "error": registrationError]) {
                try? data.write(to: URL(fileURLWithPath: directory).appendingPathComponent("registration.json"), options: .atomic)
            }
        }
        if global && attemptedGlobalRegistration { return }
        let allowed = global || front == config["bundle"] || front == Bundle.main.bundleIdentifier || (config["testMode"] == "1" && front == "com.google.Chrome")
        guard allowed else { shortcutStatus?.stringValue = "Optional shortcuts activate in \(config["hostName"] ?? "the configured host")."; return }
        registrationError = ""
        guard let policy = policy else { registrationError = "Missing shortcut configuration. Use the LH menu."; return }
        registrationStatuses = []
        if global { attemptedGlobalRegistration = true }
        let keys = ["l": kVK_ANSI_L, "o": kVK_ANSI_O, "m": kVK_ANSI_M]
        for spec in policy.combos {
            guard let key = keys[spec.key], spec.action >= 1 && spec.action <= 3 else { registrationError = "Invalid shortcut configuration. Use the LH menu."; continue }
            let modifiers = spec.modifiers.reduce(0) { flags, modifier in flags | (modifier == "control" ? controlKey : modifier == "option" ? optionKey : modifier == "command" ? cmdKey : modifier == "shift" ? shiftKey : 0) }
            var ref: EventHotKeyRef?
            let status = RegisterEventHotKey(UInt32(key), UInt32(modifiers), EventHotKeyID(signature: 0x4c484b59, id: spec.action), GetApplicationEventTarget(), OptionBits(kEventHotKeyExclusive), &ref)
            registrationStatuses.append(status)
            if status == noErr, let ref = ref { refs.append(ref) } else { registrationError = "A shortcut is already in use (\(status)). Use the LH menu." }
        }
        item.button?.toolTip = registrationError.isEmpty ? "LearningHarness — \(config["hostName"] ?? "") controls" : registrationError
        shortcutStatus?.stringValue = registrationError.isEmpty ? "\(self.policy?.scope == "global" ? "Global" : "Optional") shortcuts: \(refs.count) active" : registrationError
    }
    // Metadata-only lease: never starts a runtime, generates learning or changes focus.
    func heartbeat() {
        guard !heartbeatBusy else { return }
        heartbeatBusy = true
        call(["status"]) { [weak self] result in
            guard let self = self else { return }
            self.heartbeatBusy = false
            if let enabled = result["enabled"] as? Bool { self.enabled = enabled }
        }
    }
    func call(_ args: [String], _ completion: @escaping ([String: Any]) -> Void) {
        guard let node = config["node"], let bridge = config["bridge"] else { completion(["error": "Missing local bridge configuration."]); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let process = Process(); process.executableURL = URL(fileURLWithPath: node); process.arguments = [bridge] + args
            let output = Pipe(); process.standardOutput = output; process.standardError = self.config["testMode"] == "1" ? output : FileHandle.nullDevice
            var environment = ProcessInfo.processInfo.environment; environment["LEARNING_HARNESS_HOST"] = self.config["host"]; environment["LEARNING_HARNESS_DATA_DIR"] = self.config["dataDirectory"]; environment.removeValue(forKey: "LH_DESKTOP_HOST"); environment.removeValue(forKey: "LH_DESKTOP_DATA_DIR"); process.environment = environment
            do {
                try process.run()
                DispatchQueue.global().asyncAfter(deadline: .now() + 15) { if process.isRunning { process.terminate() } }
                // The bridge emits one bounded metadata response; never log learner content.
                var data = Data()
                while true {
                    let chunk = output.fileHandleForReading.availableData
                    if chunk.isEmpty { break }
                    if data.count + chunk.count > 131072 { process.terminate(); break }
                    data.append(chunk)
                }
                process.waitUntilExit()
                let value = data.count <= 131072 ? (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] : nil
                DispatchQueue.main.async { completion(value ?? ["error": self.config["testMode"] == "1" ? String(data: data.prefix(1000), encoding: .utf8) ?? "Empty bridge response" : "Local controls did not respond. Open Learn to check the connection."]) }
            } catch { DispatchQueue.main.async { completion(["error": "Could not start local controls."]) } }
        }
    }
    func show(_ text: String) {
        if window == nil {
            window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 470, height: 270), styleMask: [.titled, .closable], backing: .buffered, defer: false)
            window.title = "LearningHarness — \(config["hostName"] ?? "")"; window.isReleasedWhenClosed = false
            let view = window.contentView!
            let hint = NSTextField(labelWithString: registrationError.isEmpty ? "\(self.policy?.scope == "global" ? "Global" : "Optional") shortcuts: \(refs.count) active" : registrationError)
            hint.font = .systemFont(ofSize: 11); hint.textColor = .secondaryLabelColor
            hint.frame = NSRect(x: 24, y: 10, width: 422, height: 18); view.addSubview(hint); shortcutStatus = hint
            message = NSTextField(wrappingLabelWithString: ""); message.frame = NSRect(x: 24, y: 165, width: 422, height: 78); view.addSubview(message)
            picker = NSPopUpButton(frame: NSRect(x: 24, y: 112, width: 422, height: 32)); picker.target = self; picker.action = #selector(selected); view.addSubview(picker)
            create = NSButton(title: "Create moment", target: self, action: #selector(start)); create.bezelStyle = .rounded; create.frame = NSRect(x: 245, y: 38, width: 200, height: 34); view.addSubview(create)
        }
        message.stringValue = text
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    func notify(_ text: String) {
        toastTimer?.invalidate(); toast?.orderOut(nil)
        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 340, height: 76), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating; panel.isOpaque = false; panel.backgroundColor = .clear; panel.hasShadow = true
        let background = NSVisualEffectView(frame: panel.contentView!.bounds)
        background.material = .hudWindow; background.state = .active; background.wantsLayer = true; background.layer?.cornerRadius = 14
        let label = NSTextField(wrappingLabelWithString: text); label.frame = NSRect(x: 20, y: 16, width: 300, height: 44); label.font = .systemFont(ofSize: 14, weight: .medium); background.addSubview(label); panel.contentView = background
        if let screen = NSScreen.main { let rect = screen.visibleFrame; panel.setFrameOrigin(NSPoint(x: rect.maxX - 364, y: rect.maxY - 100)) }
        panel.orderFrontRegardless(); toast = panel
        toastTimer = Timer.scheduledTimer(withTimeInterval: 3.5, repeats: false) { [weak self] _ in self?.toast?.orderOut(nil); self?.toast = nil }
    }
    func status(_ args: [String]) {
        guard !settingStatus else { return }; settingStatus = true
        call(args) { result in
            self.settingStatus = false
            if let enabled = result["enabled"] as? Bool { self.enabled = enabled }
            self.notify(result["error"] as? String ?? ((result["enabled"] as? Bool == true) ? "Learning is on for \(self.config["hostName"] ?? "this host"). Open Learn in a chat to follow along." : "Learning is off. Your memory and settings are kept."))

        }
    }
    @objc func on() { status(["on"]) }
    @objc func off() { status(["off"]) }
    @objc func choose() {
        guard !busy else { return }; busy = true
        show("\(config["hostName"] ?? "") — Choose the coding chat for this learning moment. This creates learning alongside your work; it does not send a message to the coding agent.")
        picker.isHidden = false; create.isHidden = false; create.isEnabled = false; picker.removeAllItems(); picker.addItem(withTitle: "Loading chats…")
        call(["chats"]) { result in
            self.busy = false
            if let error = result["error"] as? String { self.message.stringValue = error; return }
            self.enabled = result["enabled"] as? Bool ?? false; self.chats = result["chats"] as? [[String: Any]] ?? []
            self.picker.removeAllItems(); self.picker.addItem(withTitle: "Choose a chat…")
            for chat in self.chats { self.picker.addItem(withTitle: "\(chat["title"] as? String ?? "Untitled") — \(chat["project"] as? String ?? "")") }
        }
    }
    @objc func selected() {
        let index = picker.indexOfSelectedItem - 1
        create.isEnabled = !busy && index >= 0 && index < chats.count
        if create.isEnabled { create.title = !enabled || (chats[index]["paused"] as? Bool == true) ? "Turn on & create" : "Create moment" }
    }
    @objc func start() {
        let index = picker.indexOfSelectedItem - 1
        guard !busy, index >= 0, index < chats.count, let id = chats[index]["id"] as? String else { return }
        busy = true; create.isEnabled = false; picker.isEnabled = false; message.stringValue = "Preparing your learning moment… You can close this window and keep working."
        let launch = { self.call(["new-moment", "--chat", id]) { result in
            if let job = result["job"] as? String { self.poll(id, job, 0) } else { self.finish(result["error"] as? String ?? "Could not start this moment.") }
        } }
        if !enabled || chats[index]["paused"] as? Bool == true {
            call(["on", "--chat", id]) { result in if let error = result["error"] as? String { self.finish(error) } else { launch() } }
        } else { launch() }
    }
    func poll(_ id: String, _ job: String, _ count: Int) {
        call(["job", "--chat", id, "--job", job]) { result in
            if let error = result["error"] as? String { self.finish(error) }
            else if result["status"] as? String == "ready" { self.finish("Your learning moment is ready. Open LearningHarness in the chosen chat to view it.") }
            else if count >= 180 { self.finish("Still preparing. Open Learn in the chosen chat to check progress.") }
            else { DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.poll(id, job, count + 1) } }
        }
    }
    func finish(_ text: String) { busy = false; picker.isEnabled = true; message.stringValue = text; selected() }
    @objc func quit() { heartbeatTimer?.invalidate(); heartbeatTimer = nil; refs.forEach { UnregisterEventHotKey($0) }; NSApp.terminate(nil) }
}
let controls = Controls()
let app = NSApplication.shared
app.delegate = controls
app.setActivationPolicy(controls.config["testMode"] == "1" ? .regular : .accessory)
app.run()
