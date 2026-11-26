using System;
using System.IO;
using System.Text;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace ProjectFM.ScreenDump
{
    /// <summary>
    /// Press F9 in FM27 to write what the screen is made of (every element's type, name, style
    /// classes and text) to a file next to this plugin. Reads only; changes nothing in the game.
    /// Used to build ProjectFM's plugins for a screen without guessing.
    /// </summary>
    [BepInPlugin("projectfm.screendump", "ProjectFM Screen Dump", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            ClassInjector.RegisterTypeInIl2Cpp<Dumper>();
            AddComponent<Dumper>();
            L.LogInfo("ProjectFM screen dump loaded: press F9 on a screen to save it.");
        }
    }

    public class Dumper : MonoBehaviour
    {
        public Dumper(IntPtr ptr) : base(ptr) { }

        private static readonly string Folder =
            Path.GetDirectoryName(typeof(Dumper).Assembly.Location) ?? Paths.PluginPath;

        private void Update()
        {
            try
            {
                var kb = Keyboard.current;
                if (kb == null || !kb.f9Key.wasPressedThisFrame) return;
                var file = Path.Combine(Folder, $"screen-{DateTime.Now:yyyyMMdd-HHmmss}.txt");
                int n = Dump(file);
                Plugin.L.LogInfo($"screen dump: {n} elements written to {file}");
            }
            catch (Exception e) { Plugin.L.LogWarning("screen dump: " + e.Message); }
        }

        private static string Classes(VisualElement e)
        {
            try
            {
                var list = e.GetClasses().TryCast<Il2CppSystem.Collections.Generic.List<string>>();
                if (list == null) return "";
                var sb = new StringBuilder();
                int n = list.Count;
                for (int i = 0; i < n && i < list.Count; i++)
                {
                    if (sb.Length > 0) sb.Append(' ');
                    sb.Append(list[i]);
                }
                return sb.ToString();
            }
            catch { return "?"; }
        }

        private static int Dump(string file)
        {
            int count = 0;
            var sb = new StringBuilder();
            var docs = UnityEngine.Object.FindObjectsOfType<UIDocument>();
            foreach (var doc in docs)
            {
                var root = doc.rootVisualElement;
                if (root == null) continue;
                sb.Append("##### UIDocument ").Append(doc.name).Append('\n');
                Walk(root, 0, sb, ref count);
            }
            File.WriteAllText(file, sb.ToString());
            return count;
        }

        private static void Walk(VisualElement e, int depth, StringBuilder sb, ref int count)
        {
            if (depth > 80) return;
            count++;
            string type;
            try { type = e.GetIl2CppType().Name; } catch { type = "?"; }
            bool shown = true;
            try { shown = e.resolvedStyle.display != DisplayStyle.None; } catch { }
            sb.Append(' ', depth).Append(type);
            if (!string.IsNullOrEmpty(e.name)) sb.Append(" #").Append(e.name);
            var cls = Classes(e);
            if (cls.Length > 0) sb.Append(" .").Append(cls.Replace(" ", " ."));
            if (!shown) sb.Append(" [hidden]");
            try
            {
                var te = e.TryCast<TextElement>();
                if (te != null && !string.IsNullOrEmpty(te.text))
                {
                    var t = te.text.Replace('\n', ' ');
                    sb.Append(" \"").Append(t.Length > 80 ? t.Substring(0, 80) + "…" : t).Append('"');
                }
            }
            catch { }
            sb.Append('\n');
            int n;
            try { n = e.childCount; } catch { return; }
            for (int i = 0; i < n; i++)
            {
                VisualElement c;
                try { c = e[i]; } catch { continue; }
                if (c != null) Walk(c, depth + 1, sb, ref count);
            }
        }
    }
}
