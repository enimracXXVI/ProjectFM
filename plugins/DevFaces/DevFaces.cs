using System;
using System.Collections.Generic;
using BepInEx.Logging;
using SI.Bindable;
using UnityEngine;
using UnityEngine.UIElements;

namespace ProjectFM.Dev
{
    /// <summary>
    /// Pitch faces test module (run by ProjectFM Dev Loader; F10 reloads it). On the tactics
    /// pitch, puts FM's own player picture (PersonPicture) beside each player's shirt, fed with
    /// the player in that position, as the MrTini23 skin does in its TacticsPositionDetailed
    /// screen file (person -> position.Player), at run time without changing game files.
    /// </summary>
    public static class Entry
    {
        private static ManualLogSource L;
        private static float next;
        private const string Mark = "pfm-face";
        private const string PersonPictureGuid = "a3126e03e5bea6348ba86f23b5c5d7de";
        private const float Size = 46f;
        private static int added;

        public static void Start(ManualLogSource log) { L = log; next = 0; added = 0; L.LogInfo("dev faces 0.1: player pictures on the tactics pitch"); }

        public static void Stop()
        {
            foreach (var root in Roots())
                foreach (var e in FindAll(root, Mark)) e.RemoveFromHierarchy();
        }

        public static void Tick()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 0.5f;
            int now = 0;
            foreach (var root in Roots())
                foreach (var row in FindAll(root, "ShirtAndRoleMovements"))
                {
                    if (Child(row, Mark) != null) continue;
                    try { Add(row); now++; }
                    catch (Exception e) { L.LogWarning("dev faces: " + e.Message); return; }
                }
            if (now > 0) { added += now; L.LogInfo($"dev faces: {now} pictures added ({added} in all)"); }
        }

        private static void Add(VisualElement row)
        {
            // Before the shirt, as in the skin
            int at = row.childCount;
            for (int i = 0; i < row.childCount; i++)
            {
                string type;
                try { type = row[i].GetIl2CppType().Name; } catch { continue; }
                if (type == "FMTacticsShirt") { at = i; break; }
            }
            var wrap = new VisualElement { name = Mark, pickingMode = PickingMode.Ignore };
            var st = wrap.style;
            st.width = new StyleLength(Size);
            st.height = new StyleLength(Size);
            st.minWidth = new StyleLength(Size);
            st.flexShrink = new StyleFloat(0f);
            st.alignSelf = new StyleEnum<Align>(Align.Center);
            st.marginRight = new StyleLength(2f);
            st.overflow = new StyleEnum<Overflow>(Overflow.Hidden);
            var r = new StyleLength(Size / 2f);
            st.borderTopLeftRadius = st.borderTopRightRadius = st.borderBottomLeftRadius = st.borderBottomRightRadius = r;
            st.backgroundColor = new StyleColor(new Color(0f, 0f, 0f, 0.25f));
            row.Insert(at, wrap);

            var remap = new BindingRemapper();
            remap.Mappings = Maps(("person", "position.Player"));
            remap.pickingMode = PickingMode.Ignore;
            Fill(remap);
            wrap.Add(remap);
            var pic = SI.Core.VisualTreeAssetExtensions.Instantiate(
                new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(PersonPictureGuid));
            if (pic != null) { Fill(pic); pic.pickingMode = PickingMode.Ignore; remap.Add(pic); }
            BindableElementUtils.BindHierarchy(wrap);
        }

        private static void Fill(VisualElement e)
        {
            e.style.width = new StyleLength(new Length(100f, LengthUnit.Percent));
            e.style.height = new StyleLength(new Length(100f, LengthUnit.Percent));
        }

        /// <summary>Mappings added through FM's own List.Add (the interop's generic Add garbles them).</summary>
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

        private static IEnumerable<VisualElement> Roots()
        {
            foreach (var doc in UnityEngine.Object.FindObjectsOfType<UIDocument>())
                if (doc.rootVisualElement != null) yield return doc.rootVisualElement;
        }

        private static List<VisualElement> FindAll(VisualElement e, string name, List<VisualElement> acc = null, int depth = 0)
        {
            acc ??= new List<VisualElement>();
            if (e.name == name) { acc.Add(e); return acc; }
            if (depth > 70) return acc;
            for (int i = 0; i < e.childCount; i++) FindAll(e[i], name, acc, depth + 1);
            return acc;
        }
    }
}
