using System;
using System.IO;
using System.Reflection;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.InputSystem;

namespace ProjectFM.DevLoader
{
    /// <summary>
    /// Test bench for ProjectFM's plugins: runs the test module ProjectFM.Dev.bin from this
    /// plugin's folder, and reloads it when F10 is pressed, so a new test needs no restart.
    /// The module is a plain .NET library with a static class that has Start(ManualLogSource),
    /// Tick() and Stop(). The file is read into memory, never locked, so it can be replaced while
    /// FM runs.
    /// </summary>
    [BepInPlugin("projectfm.devloader", "ProjectFM Dev Loader", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo("ProjectFM dev loader loaded: F10 reloads ProjectFM.Dev.bin.");
        }
    }

    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }

        private static readonly string File_ = Path.Combine(
            Path.GetDirectoryName(typeof(Runner).Assembly.Location) ?? Paths.PluginPath, "ProjectFM.Dev.bin");

        private MethodInfo tick, stop;
        private bool started;
        private int errors;

        private void Update()
        {
            try
            {
                if (!started) { started = true; Reload(); }
                var kb = Keyboard.current;
                if (kb != null && kb.f10Key.wasPressedThisFrame) Reload();
                if (tick != null) tick.Invoke(null, null);
                errors = 0;
            }
            catch (Exception e)
            {
                if (++errors <= 3) Plugin.L.LogWarning("dev: " + (e.InnerException ?? e));
                if (errors >= 3) { tick = null; Plugin.L.LogWarning("dev: module stopped after errors; fix and press F10"); }
            }
        }

        private void Reload()
        {
            try { stop?.Invoke(null, null); } catch (Exception e) { Plugin.L.LogWarning("dev: stop: " + (e.InnerException ?? e).Message); }
            tick = stop = null;
            if (!File.Exists(File_)) { Plugin.L.LogInfo($"dev: no module at {File_}"); return; }
            var asm = Assembly.Load(File.ReadAllBytes(File_));
            foreach (var t in asm.GetTypes())
            {
                var start = t.GetMethod("Start", BindingFlags.Public | BindingFlags.Static);
                var tk = t.GetMethod("Tick", BindingFlags.Public | BindingFlags.Static);
                if (start == null || tk == null) continue;
                start.Invoke(null, new object[] { Plugin.L });
                tick = tk;
                stop = t.GetMethod("Stop", BindingFlags.Public | BindingFlags.Static);
                Plugin.L.LogInfo($"dev: module {asm.GetName().Name} {asm.GetName().Version} started ({t.FullName})");
                return;
            }
            Plugin.L.LogWarning("dev: module has no class with Start and Tick");
        }
    }
}
