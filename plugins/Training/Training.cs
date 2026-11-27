using System;
using System.Globalization;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Training
{
    [BepInPlugin("projectfm.training", "ProjectFM Training", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"training: loaded (player list {Settings.ListWidth:0}% wide)");
        }
    }

    /// <summary>Training.cfg next to the plugin.</summary>
    internal static class Settings
    {
        public static float ListWidth = 45f;
        private static readonly string Path = System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath, "Training.cfg");
        private static DateTime stamp;

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path))
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Training. Edit while FM runs: applied within 2 seconds.",
                        "# Individual training: width of the player list, in % of the block (FM's own is 30)",
                        "ListWidth = 45",
                    });
                stamp = File.GetLastWriteTimeUtc(Path);
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var k = line.Substring(0, eq).Trim().ToLowerInvariant();
                    var v = line.Substring(eq + 1).Trim();
                    if (k == "listwidth" && float.TryParse(v.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n))
                        ListWidth = Math.Clamp(n, 15f, 85f);
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("training: settings: " + e.Message); }
        }

        public static void Reload()
        {
            try { if (File.Exists(Path) && File.GetLastWriteTimeUtc(Path) != stamp) Load(); } catch { }
        }
    }

    /// <summary>
    /// Individual training screen: FM gives the player list 30% of the block
    /// (a ComponentElement with width-30-percent); it gets the width from the settings.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private float next, nextCfg;
        private int errors;
        private bool told;

        private void Update()
        {
            if (Time.realtimeSinceStartup >= nextCfg) { nextCfg = Time.realtimeSinceStartup + 2f; Settings.Reload(); }
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            try
            {
                foreach (var doc in FindObjectsOfType<UIDocument>())
                {
                    var root = doc.rootVisualElement;
                    if (root == null) continue;
                    var block = Find(root, "IndividualTrainingBlock", 0);
                    if (block == null) continue;
                    var list = FindClass(block, "width-30-percent", 0);
                    if (list == null) continue;
                    list.style.width = new StyleLength(new Length(Settings.ListWidth, LengthUnit.Percent));
                    list.style.flexShrink = new StyleFloat(0f);
                    if (!told) { told = true; Plugin.L.LogInfo($"training: player list widened to {Settings.ListWidth:0}%"); }
                }
                errors = 0;
            }
            catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("training: " + e.Message); }
        }

        private static VisualElement Find(VisualElement e, string name, int depth)
        {
            if (e.name == name) return e;
            if (depth > 40) return null;
            for (int i = 0; i < e.childCount; i++) { var r = Find(e[i], name, depth + 1); if (r != null) return r; }
            return null;
        }

        private static VisualElement FindClass(VisualElement e, string cls, int depth)
        {
            if (e.ClassListContains(cls)) return e;
            if (depth > 12) return null;
            for (int i = 0; i < e.childCount; i++) { var r = FindClass(e[i], cls, depth + 1); if (r != null) return r; }
            return null;
        }
    }
}
