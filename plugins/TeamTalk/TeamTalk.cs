using System;
using System.Collections.Generic;
using System.IO;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using Il2CppInterop.Runtime.InteropTypes.Arrays;
using SI.Bindable;
using UnityEngine;

namespace ProjectFM.TeamTalk
{
    [BepInPlugin("projectfm.teamtalk", "ProjectFM Team Talk", "1.0.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"team talk: loaded (morale = {Settings.Morale}, fatigue = {Settings.Fatigue})");
        }
    }

    /// <summary>TeamTalk.cfg next to the plugin.</summary>
    internal static class Settings
    {
        public static bool Morale = true, Fatigue = true;
        public static float MoraleWidth = 140, FatigueWidth = 50;
        private static readonly string Path = System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath, "TeamTalk.cfg");

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path))
                {
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Team Talk: extra columns in the team talk table. Restart FM after changing.",
                        "Morale = true",
                        "MoraleWidth = 140",
                        "Fatigue = true",
                        "FatigueWidth = 50",
                    });
                    return;
                }
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    var k = line.Substring(0, eq).Trim().ToLowerInvariant();
                    var v = line.Substring(eq + 1).Trim().ToLowerInvariant();
                    bool on = v == "true" || v == "1" || v == "yes";
                    float.TryParse(v, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n);
                    switch (k)
                    {
                        case "morale": Morale = on; break;
                        case "fatigue": Fatigue = on; break;
                        case "moralewidth": if (n > 20) MoraleWidth = n; break;
                        case "fatiguewidth": if (n > 20) FatigueWidth = n; break;
                    }
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("team talk: settings: " + e.Message); }
        }
    }

    /// <summary>
    /// Morale and fatigue in the team talk table (pre-match, half time, full time). FM's team talk
    /// table only knows its own columns, so FM's squad-table morale and fatigue columns are copied
    /// into it, fed with the player of each team talk row (binding.Player.Person), and added to the
    /// three team talk views after Match Sharpness.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private const string MoraleId = "pfm-morale", FatigueId = "pfm-fatigue";
        private static readonly string[] Views = { "TeamTalksTablePreMatch", "TeamTalksTableHalfTime", "TeamTalksTableFullTime" };
        private readonly HashSet<IntPtr> doneFactories = new(), doneViews = new();
        private float next;
        private int errors;

        private void Update()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 2f;
            if (!Settings.Morale && !Settings.Fatigue) return;
            try { Patch(); errors = 0; }
            catch (Exception e) { if (++errors <= 3) Plugin.L.LogWarning("team talk: " + e); }
        }

        private void Patch()
        {
            TableTemplate players = null, talk = null;
            foreach (var t in Resources.FindObjectsOfTypeAll<TableTemplate>())
            {
                if (t == null) continue;
                if (t.name == "PlayerTableFactory") players = t;
                else if (t.name == "TeamTalkPlayerReactionTableFactory") talk = t;
            }
            if (talk != null && players != null && !doneFactories.Contains(talk.Pointer))
            {
                doneFactories.Add(talk.Pointer);
                int added = 0;
                if (Settings.Morale && AddRow(players, talk, "morale", MoraleId, "binding.Player.Person", "binding.Player.Person.morale")) added++;
                if (Settings.Fatigue && AddRow(players, talk, "fatigue-icon", FatigueId, "binding.Player.Person.fatigue", "binding.Player.Person.fatigue")) added++;
                Plugin.L.LogInfo($"team talk: {added} columns added to FM's team talk table");
            }
            if (talk == null || !doneFactories.Contains(talk.Pointer)) return;
            foreach (var s in Resources.FindObjectsOfTypeAll<StreamedTableViewSettings>())
            {
                if (s == null || doneViews.Contains(s.Pointer) || Array.IndexOf(Views, s.name) < 0) continue;
                doneViews.Add(s.Pointer);
                var list = s.m_tableView?.m_tableConfig;
                if (list == null) continue;
                int at = -1;
                for (int i = 0; i < list.Count; i++) if (list[i].m_columnID == "sharpness") at = i + 1;
                if (at < 0) at = list.Count;
                var template = list[Math.Max(0, at - 1)];
                int n = 0;
                if (Settings.Fatigue && !Has(list, FatigueId)) { list.Insert(at, Column(template, FatigueId, Settings.FatigueWidth)); n++; }
                if (Settings.Morale && !Has(list, MoraleId)) { list.Insert(at, Column(template, MoraleId, Settings.MoraleWidth)); n++; }
                Plugin.L.LogInfo($"team talk: {n} columns added to the view '{s.name}'");
            }
        }

        private static bool Has(Il2CppSystem.Collections.Generic.List<StreamedTableView.ColumnConfiguration> list, string id)
        {
            for (int i = 0; i < list.Count; i++) if (list[i].m_columnID == id) return true;
            return false;
        }

        private static StreamedTableView.ColumnConfiguration Column(StreamedTableView.ColumnConfiguration template, string id, float width)
        {
            var c = template.MemberwiseClone().Cast<StreamedTableView.ColumnConfiguration>();
            c.m_columnID = id;
            if (template.m_columnMetadata != null)
            {
                var m = template.m_columnMetadata.MemberwiseClone().Cast<StreamedTableView.ColumnMetadata>();
                m.m_widthOverride = width;
                m.m_minWidthOverride = width;
                c.m_columnMetadata = m;
            }
            return c;
        }

        /// <summary>Copies a squad-table column into the team talk table, fed by the given path.</summary>
        private static bool AddRow(TableTemplate from, TableTemplate to, string fromId, string newId, string bindingPath, string sortPath)
        {
            var rows = to.RowDataList;
            for (int i = 0; i < rows.Length; i++) if (rows[i].m_id == newId) return false;
            TableTemplate.RowData src = null;
            var fromRows = from.RowDataList;
            for (int i = 0; i < fromRows.Length; i++) if (fromRows[i].m_id == fromId) { src = fromRows[i]; break; }
            if (src == null) { Plugin.L.LogWarning($"team talk: FM's '{fromId}' column not found"); return false; }

            var row = src.MemberwiseClone().Cast<TableTemplate.RowData>();
            row.m_id = newId;
            row.m_sortBinding = new BindingPath(sortPath);
            // FM's own value lists: "binding" now comes from the team talk row's player, "team" from its team
            row.m_valueBindings = Remaps(src.m_valueBindings, bindingPath, "binding.Team");
            row.m_footerValueBindings = Remaps(src.m_footerValueBindings, null, null);
            var grown = new Il2CppReferenceArray<TableTemplate.RowData>(rows.Length + 1);
            for (int i = 0; i < rows.Length; i++) grown[i] = rows[i];
            grown[rows.Length] = row;
            to.m_rowData = grown;
            var lookup = to.m_rowDataLookup;
            if (lookup != null) lookup[newId] = row;
            return true;
        }

        private static Il2CppSystem.Collections.Generic.List<RemapInfo> Remaps(Il2CppSystem.Collections.Generic.List<RemapInfo> src, string binding, string team)
        {
            var list = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            if (src == null) return list;
            // The interop's List<struct>.Add drops the value; FM's own Add, called through reflection, keeps it
            var add = list.GetIl2CppType().GetMethod("Add");
            for (int i = 0; i < src.Count; i++)
            {
                var m = src[i];
                if (binding != null && m.from == "binding") m.to = new BindingPath(binding);
                else if (team != null && m.from == "team") m.to = new BindingPath(team);
                var args = new Il2CppReferenceArray<Il2CppSystem.Object>(1);
                args[0] = m;
                add.Invoke(list, args);
            }
            return list;
        }
    }
}
