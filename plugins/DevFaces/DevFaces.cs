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
        private static int added;

        public static void Start(ManualLogSource log) { L = log; next = 0; added = 0; L.LogInfo("dev faces 0.2: picture outside the card, left of the shirt row, as tall as it"); }

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
                foreach (var row in FindAll(root, "ShirtAndIcons"))
                {
                    var face = Child(row, Mark);
                    if (face != null) { Fit(face, row); continue; }
                    try { Fit(Add(row), row); now++; }
                    catch (Exception e) { L.LogWarning("dev faces: " + e.Message); return; }
                }
            if (now > 0) { added += now; L.LogInfo($"dev faces: {now} pictures added ({added} in all)"); }
        }

        /// <summary>
        /// The picture sits outside the card, just left of its shirt row (absolutely placed), so
        /// nothing in the card moves: the shirt and both role arrows stay where FM puts them.
        /// </summary>
        private static VisualElement Add(VisualElement row)
        {
            var wrap = new VisualElement { name = Mark, pickingMode = PickingMode.Ignore };
            var st = wrap.style;
            st.position = new StyleEnum<Position>(Position.Absolute);
            st.right = new StyleLength(new Length(100f, LengthUnit.Percent));
            st.top = new StyleLength(0f);
            st.marginRight = new StyleLength(2f);
            st.overflow = new StyleEnum<Overflow>(Overflow.Hidden);
            st.backgroundColor = new StyleColor(new Color(0f, 0f, 0f, 0.25f));
            row.Add(wrap);

            var remap = new BindingRemapper();
            remap.Mappings = Maps(("person", "position.Player"));
            remap.pickingMode = PickingMode.Ignore;
            Fill(remap);
            wrap.Add(remap);
            var pic = SI.Core.VisualTreeAssetExtensions.Instantiate(
                new UnityEngine.AddressableAssets.AssetReferenceT<VisualTreeAsset>(PersonPictureGuid));
            if (pic != null) { Fill(pic); pic.pickingMode = PickingMode.Ignore; remap.Add(pic); }
            BindableElementUtils.BindHierarchy(wrap);
            return wrap;
        }

        /// <summary>A round picture as tall as the shirt row.</summary>
        private static void Fit(VisualElement face, VisualElement row)
        {
            float h = row.resolvedStyle.height;
            if (float.IsNaN(h) || h < 10f) return;
            if (Math.Abs(face.resolvedStyle.width - h) < 1f) return;
            var st = face.style;
            st.width = st.height = st.minWidth = new StyleLength(h);
            var r = new StyleLength(h / 2f);
            st.borderTopLeftRadius = st.borderTopRightRadius = st.borderBottomLeftRadius = st.borderBottomRightRadius = r;
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
