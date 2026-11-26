using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.StaffOverview
{
    /// <summary>
    /// Staff Overview: under each card (Coaching, Recruitment, Medical) adds FM's own staff
    /// contract table for that department and FM's team comparison, fed by FM's own data (the
    /// pieces and data the MrTini23 skin wires in its screen file, added at run time without
    /// changing game files). The roles list, the staff list and the comparison fold with a
    /// chevron; folds are saved in StaffOverview.cfg next to the plugin.
    /// </summary>
    [BepInPlugin("projectfm.staffoverview", "ProjectFM Staff Overview", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            ClassInjector.RegisterTypeInIl2Cpp<Adder>();
            AddComponent<Adder>();
            L.LogInfo("ProjectFM staff overview loaded.");
        }
    }

    public class Adder : MonoBehaviour
    {
        public Adder(IntPtr ptr) : base(ptr) { }

        private float next;
        private int errors;

        private void Update()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            try { Staff.Tick(); errors = 0; }
            catch (Exception e)
            {
                if (++errors <= 5) Plugin.L.LogWarning("staff overview: " + e);
                if (errors >= 5) next = Time.realtimeSinceStartup + 10f;
            }
        }
    }

    internal static class Staff
    {
        private const string Mark = "pfm-staff";
        private const string CompareName = "pfm-staff-compare";
        private const string FoldName = "pfm-fold";
        private static readonly string[] CardNames = { "ClubCoachingStaff", "ClubRecruitmentStaff", "ClubMedicalStaff" };

        // FM's asset ids (Addressables GUIDs, as FM's own screen files reference them)
        private const string TableGuid = "b00fa0597031b5642ba1e26ca3fb6ee0"; // ClubStaffTeamContractBlock
        private static readonly Dictionary<string, (string guid, string data)> Compare = new Dictionary<string, (string, string)>
        {
            ["ClubCoachingStaff"] = ("bb6a535ad4ad38446ac0e1b3552b4c85", "team.StaffCoachingSubGroupComparisonAttributes"),
            ["ClubRecruitmentStaff"] = ("1a3bc8c395c7a6f44983a8f52f4322de", "team.StaffRecruitmentSubGroupComparisonAttributes"),
            ["ClubMedicalStaff"] = ("9e54f89e398f44d41a54ed08d9c42a85", "team.StaffMedicalSubGroupComparisonAttributes"),
        };

        // ---- Folds, saved next to the plugin ----
        private static readonly string ConfigPath = Path.Combine(
            Path.GetDirectoryName(typeof(Staff).Assembly.Location) ?? Paths.PluginPath, "StaffOverview.cfg");
        private static Dictionary<string, bool> folds;

        private static bool Default(string key) => !key.EndsWith("/roles"); // roles open, the rest folded

        private static bool IsFolded(string key)
        {
            LoadFolds();
            return folds.TryGetValue(key, out var f) ? f : Default(key);
        }

        private static void SetFolded(string key, bool folded)
        {
            LoadFolds();
            folds[key] = folded;
            try
            {
                var lines = new List<string>
                {
                    "# ProjectFM Staff Overview: which parts of each Staff Overview card are folded.",
                    "# folded or open. Delete this file to go back to the defaults (roles open, the rest folded).",
                };
                foreach (var card in CardNames)
                    foreach (var part in new[] { "roles", "staff", "compare" })
                    {
                        var k = card + "/" + part;
                        lines.Add($"{k} = {(IsFolded(k) ? "folded" : "open")}");
                    }
                File.WriteAllLines(ConfigPath, lines);
            }
            catch (Exception e) { Plugin.L.LogWarning("staff overview: can't save folds: " + e.Message); }
        }

        private static void LoadFolds()
        {
            if (folds != null) return;
            folds = new Dictionary<string, bool>();
            try
            {
                if (!File.Exists(ConfigPath)) return;
                foreach (var raw in File.ReadAllLines(ConfigPath))
                {
                    var line = raw.Trim();
                    if (line.Length == 0 || line.StartsWith("#")) continue;
                    var eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var v = line.Substring(eq + 1).Trim().ToLowerInvariant();
                    folds[line.Substring(0, eq).Trim()] = v.StartsWith("fold") || v == "true" || v == "yes";
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("staff overview: can't read folds: " + e.Message); }
        }

        // ---- Adding the pieces ----
        public static void Tick()
        {
            foreach (var root in Roots())
                foreach (var name in CardNames)
                {
                    var card = Find(root, name);
                    var board = card == null ? null : Find(card, "SIVisible_IsClub");
                    var parent = board?.parent;
                    if (parent == null || Find(parent, Mark) != null) continue;
                    var box = new VisualElement { name = Mark };
                    parent.Insert(parent.IndexOf(board) + 1, box);
                    try { Add(box, parent, card, name); }
                    catch (Exception e) { Plugin.L.LogWarning($"staff overview: {name}: {e}"); }
                }
        }

        /// <summary>
        /// A mapping list filled through FM's own List.Add, called by reflection: the interop's
        /// generic Add passes the boxed struct where FM expects the value, which left mappings blank.
        /// </summary>
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

        private static VisualElement Build(string guid)
        {
            var r = new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(guid);
            return SI.Core.VisualTreeAssetExtensions.Instantiate(r);
        }

        private static void Grow(VisualElement e, bool grow = true)
        {
            e.style.alignSelf = new StyleEnum<Align>(Align.Stretch);
            e.style.flexGrow = new StyleFloat(grow ? 1f : 0f);
            e.style.flexShrink = new StyleFloat(1f);
            e.style.flexBasis = grow ? new StyleLength(0f) : new StyleLength(StyleKeyword.Auto);
            e.style.minHeight = new StyleLength(0f);
            e.style.width = new StyleLength(new Length(100f, LengthUnit.Percent));
        }

        private static void Keep(VisualElement e)
        {
            e.style.alignSelf = new StyleEnum<Align>(Align.Stretch);
            e.style.flexShrink = new StyleFloat(0f);
            e.style.width = new StyleLength(new Length(100f, LengthUnit.Percent));
        }

        private static void Add(VisualElement box, VisualElement parent, VisualElement card, string name)
        {
            // As the MrTini23 skin lays it out: the table takes the card's free height, the
            // comparison keeps its own height after it
            Grow(box);
            box.AddToClassList("margin-top-global-gap-large");
            var tr = new BindingRemapper();
            tr.Mappings = Maps(
                ("personlist", "staffsubgroup.StaffSubGroupPersonListFiltered"),
                ("filter", "team.StaffListFilter"),
                ("isAllStaffTab", "const.False"),
                ("showQuickFlicks", "const.False"),
                ("showBlockAppearance", "const.False"));
            Grow(tr);
            box.Add(tr);
            var table = Build(TableGuid);
            if (table != null) { Grow(table); tr.Add(table); }

            var (guid, data) = Compare[name];
            var cr = new BindingRemapper { name = CompareName };
            cr.Mappings = Maps(("attributes", data));
            Keep(cr);
            cr.AddToClassList("margin-top-global-gap-large");
            parent.Insert(parent.IndexOf(box) + 1, cr);
            var cmp = Build(guid);
            if (cmp != null) { Keep(cmp); cr.Add(cmp); }

            BindableElementUtils.BindHierarchy(box);
            BindableElementUtils.BindHierarchy(cr);

            // Fold buttons: roles list (card title row), staff list (after Filter), comparison
            var header = Find(card, name.Replace("Club", "") + "Header");
            var roles = Find(card, "StreamedTable_JobsList");
            if (header != null && roles != null)
            {
                header.style.flexGrow = new StyleFloat(1f);
                header.Add(Fold(name + "/roles", () => new List<VisualElement> { roles }));
            }
            var tableHeader = table == null ? null : Find(table, "Header");
            if (tableHeader?.parent != null)
            {
                var holder = tableHeader.parent;
                tableHeader.Add(Fold(name + "/staff", () => Others(holder, tableHeader), folded =>
                {
                    foreach (var e in new[] { box, tr, table }) Grow(e, !folded);
                }));
            }
            var heading = cmp == null ? null : Find(cmp, "FullHeadingFrame");
            if (heading?.parent != null)
            {
                var block = heading.parent;
                heading.Add(Fold(name + "/compare", () => Others(block, heading)));
            }
            Plugin.L.LogInfo($"staff overview: {name}: table {(table != null ? "added" : "missing")}, comparison {(cmp != null ? "added" : "missing")}");
        }

        private static List<VisualElement> Others(VisualElement holder, VisualElement keep)
        {
            var list = new List<VisualElement>();
            for (int i = 0; i < holder.childCount; i++)
                if (holder[i] != keep) list.Add(holder[i]);
            return list;
        }

        /// <summary>A chevron button that shows or hides some parts of the card.</summary>
        private static Button Fold(string key, Func<List<VisualElement>> parts, Action<bool> after = null)
        {
            var b = new Button { name = FoldName, tooltip = "Show or hide" };
            var icon = new VisualElement();
            icon.AddToClassList("ui-concepts-chevron-down_small");
            icon.style.width = new StyleLength(16f);
            icon.style.height = new StyleLength(16f);
            b.Add(icon);
            var st = b.style;
            st.backgroundColor = new StyleColor(new Color(1f, 1f, 1f, 0.06f));
            st.borderTopWidth = st.borderBottomWidth = st.borderLeftWidth = st.borderRightWidth = new StyleFloat(0f);
            st.borderTopLeftRadius = st.borderTopRightRadius = st.borderBottomLeftRadius = st.borderBottomRightRadius = new StyleLength(6f);
            st.width = new StyleLength(28f);
            st.height = new StyleLength(28f);
            st.paddingLeft = st.paddingRight = st.paddingTop = st.paddingBottom = new StyleLength(0f);
            st.marginLeft = new StyleLength(StyleKeyword.Auto);
            st.alignItems = new StyleEnum<Align>(Align.Center);
            st.justifyContent = new StyleEnum<Justify>(Justify.Center);
            st.alignSelf = new StyleEnum<Align>(Align.Center);
            st.flexShrink = new StyleFloat(0f);
            void Apply()
            {
                bool folded = IsFolded(key);
                foreach (var e in parts()) e.style.display = folded ? DisplayStyle.None : DisplayStyle.Flex;
                after?.Invoke(folded);
                icon.style.rotate = new StyleRotate(new Rotate(new Angle(folded ? -90f : 0f, AngleUnit.Degree)));
            }
            b.add_clicked((Il2CppSystem.Action)new Action(() =>
            {
                SetFolded(key, !IsFolded(key));
                Apply();
            }));
            Apply();
            return b;
        }

        private static IEnumerable<VisualElement> Roots()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
                if (doc.rootVisualElement != null) yield return doc.rootVisualElement;
        }

        private static VisualElement Find(VisualElement e, string name, int depth = 0)
        {
            if (e.name == name) return e;
            if (depth > 60) return null;
            for (int i = 0; i < e.childCount; i++)
            {
                var r = Find(e[i], name, depth + 1);
                if (r != null) return r;
            }
            return null;
        }
    }
}
