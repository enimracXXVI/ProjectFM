using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Attributes;
using Il2CppInterop.Runtime.Injection;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.MatchFaces
{
    [BepInPlugin("projectfm.matchfaces", "ProjectFM Match Faces", "1.1.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"match faces: picture {Settings.Size:0}px");
        }
    }

    /// <summary>MatchFaces.cfg next to the plugin.</summary>
    internal static class Settings
    {
        public static float Size = 32f, Gap = 2f;
        public static bool StatsBox = true;
        private static readonly string Path = System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath, "MatchFaces.cfg");

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path))
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Match Faces: player pictures next to the shirts in the match squad bar.",
                        "# Size of the picture and the gap to the shirt (pixels). Restart FM after changing.",
                        "Size = 32",
                        "Gap = 2",
                        "# Box with the player's match stats next to FM's menu when you click a player (1 on, 0 off)",
                        "StatsBox = 1",
                    });
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var k = line.Substring(0, eq).Trim().ToLowerInvariant();
                    if (!float.TryParse(line.Substring(eq + 1).Trim().Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n)) continue;
                    if (k == "size") Size = Math.Clamp(n, 16f, 80f);
                    if (k == "gap") Gap = Math.Clamp(n, -20f, 20f);
                    if (k == "statsbox") StatsBox = n != 0;
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("match faces: settings: " + e.Message); }
        }
    }

    /// <summary>
    /// Match screen squad bar (FM's SquadOverviewPlayerBlock, one per player, fed by the match
    /// player "playerinfo"): FM's own player picture (PersonPicture) is put left of each shirt,
    /// fed with playerinfo.person.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private const string Mark = "pfm-match-face";
        private const string PersonPictureGuid = "a3126e03e5bea6348ba86f23b5c5d7de";
        private float next;
        private int errors, added;
        private bool told;

        private void Update()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            try
            {
                foreach (var doc in FindObjectsOfType<UIDocument>())
                {
                    var root = doc.rootVisualElement;
                    if (root == null) continue;
                    foreach (var block in FindAll(root, "BindingRoot_SquadOverviewPlayerBlock"))
                    {
                        var shirt = FindAll(block, "Shirt");
                        if (shirt.Count == 0) continue;
                        var holder = shirt[0].parent;          // SITemporaryClassOnChange around the shirt
                        var row = holder?.parent;              // the row with the goal/assist spacers
                        if (row == null || Child(row, Mark) != null) continue;
                        var face = Face();
                        row.Insert(row.IndexOf(holder), face);
                        BindableElementUtils.BindHierarchy(face);
                        added++;
                    }
                }
                if (added > 0 && !told) { told = true; Plugin.L.LogInfo($"match faces: pictures added to the match squad bar ({added})"); }
                if (Settings.StatsBox) StatsBox.Tick();
                errors = 0;
            }
            catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("match faces: " + e.Message); }
        }

        [HideFromIl2Cpp]
        private static VisualElement Face()
        {
            var wrap = new VisualElement { name = Mark, pickingMode = PickingMode.Ignore };
            var st = wrap.style;
            st.width = st.height = st.minWidth = st.maxWidth = st.minHeight = st.maxHeight = new StyleLength(Settings.Size);
            st.flexShrink = 0f;
            st.alignSelf = Align.Center;
            st.marginRight = Settings.Gap;
            var remap = new BindingRemapper();
            remap.Mappings = Maps(("person", "playerinfo.person"));
            remap.pickingMode = PickingMode.Ignore;
            Fill(remap);
            wrap.Add(remap);
            var pic = SI.Core.VisualTreeAssetExtensions.Instantiate(
                new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(PersonPictureGuid));
            if (pic != null) { Fill(pic); pic.pickingMode = PickingMode.Ignore; NoPicking(pic); remap.Add(pic); }
            return wrap;
        }

        private static void NoPicking(VisualElement e)
        {
            e.pickingMode = PickingMode.Ignore;
            for (int i = 0; i < e.childCount; i++) NoPicking(e[i]);
        }

        private static void Fill(VisualElement e)
        {
            e.style.width = new StyleLength(new Length(100f, LengthUnit.Percent));
            e.style.height = new StyleLength(new Length(100f, LengthUnit.Percent));
        }

        /// <summary>Mappings added through FM's own List.Add (the interop's generic Add garbles them).</summary>
        [HideFromIl2Cpp]
        private static Il2CppSystem.Collections.Generic.List<RemapInfo> Maps(params (string from, string to)[] maps)
        {
            var list = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            var add = list.GetIl2CppType().GetMethod("Add");
            foreach (var (from, to) in maps)
            {
                var m = new RemapInfo();
                m.from = from;
                m.to = BindingPath.Create(to);
                var args = new Il2CppInterop.Runtime.InteropTypes.Arrays.Il2CppReferenceArray<Il2CppSystem.Object>(1);
                args[0] = m;
                add.Invoke(list, args);
            }
            return list;
        }

        private static VisualElement Child(VisualElement e, string name)
        {
            for (int i = 0; i < e.childCount; i++) if (e[i].name == name) return e[i];
            return null;
        }

        [HideFromIl2Cpp]
        private static List<VisualElement> FindAll(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 60) return acc;
            for (int i = 0; i < e.childCount; i++) FindAll(e[i], name, acc, depth + 1);
            return acc;
        }
    }
}
