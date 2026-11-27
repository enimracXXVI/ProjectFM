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
    [BepInPlugin("projectfm.teamtalk", "ProjectFM Team Talk", "1.1.0")]
    public class Plugin : BasePlugin
    {
        internal static ManualLogSource L;

        public override void Load()
        {
            L = Log;
            Settings.Load();
            ClassInjector.RegisterTypeInIl2Cpp<Runner>();
            AddComponent<Runner>();
            L.LogInfo($"team talk: loaded, {Settings.Columns.Count} extra columns: {string.Join(", ", Settings.Columns.ConvertAll(c => c.id))}");
        }
    }

    /// <summary>TeamTalk.cfg next to the plugin.</summary>
    internal static class Settings
    {
        /// <summary>FM squad-table column ids to add, in order, with an optional width.</summary>
        public static readonly List<(string id, float width)> Columns = new();
        public static readonly string Folder = System.IO.Path.GetDirectoryName(typeof(Settings).Assembly.Location) ?? Paths.PluginPath;
        private static readonly string Path = System.IO.Path.Combine(Folder, "TeamTalk.cfg");

        public static void Load()
        {
            try
            {
                if (!File.Exists(Path) || !File.ReadAllText(Path).Contains("Columns"))
                {
                    File.WriteAllLines(Path, new[]
                    {
                        "# ProjectFM Team Talk: extra columns in the team talk table (pre-match, half time, full time).",
                        "# Columns: FM squad-table columns to add after Match Sharpness, in order, separated by commas.",
                        "# Add :width to set a column's width, e.g. morale:140. Leave empty for no extra columns.",
                        "# All the column names you can use are in TeamTalk-columns.txt (written once FM's tables load).",
                        "# Restart FM after changing.",
                        "Columns = morale:140, fatigue-icon:50",
                    });
                }
                foreach (var raw in File.ReadAllLines(Path))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0 || line.Substring(0, eq).Trim().ToLowerInvariant() != "columns") continue;
                    foreach (var part in line.Substring(eq + 1).Split(','))
                    {
                        var p = part.Trim();
                        if (p.Length == 0) continue;
                        float w = 0;
                        int c = p.IndexOf(':');
                        if (c > 0)
                        {
                            float.TryParse(p.Substring(c + 1).Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out w);
                            p = p.Substring(0, c).Trim();
                        }
                        Columns.Add((p.ToLowerInvariant(), w));
                    }
                }
            }
            catch (Exception e) { Plugin.L.LogWarning("team talk: settings: " + e.Message); }
        }
    }

    /// <summary>
    /// Extra columns (morale and fatigue by default) in the team talk table (pre-match, half time, full time). FM's team talk
    /// table only knows its own columns, so FM's squad-table morale and fatigue columns are copied
    /// into it, fed with the player of each team talk row (binding.Player.Person), and added to the
    /// three team talk views after Match Sharpness.
    /// </summary>
    public class Runner : MonoBehaviour
    {
        public Runner(IntPtr ptr) : base(ptr) { }
        private const string Prefix = "pfm-";
        private bool listed;
        private static readonly string[] Views = { "TeamTalksTablePreMatch", "TeamTalksTableHalfTime", "TeamTalksTableFullTime" };
        private readonly HashSet<IntPtr> doneFactories = new(), doneViews = new();
        private float next;
        private int errors;

        private void Update()
        {
            if (Time.realtimeSinceStartup < next) return;
            next = Time.realtimeSinceStartup + 2f;
            if (Settings.Columns.Count == 0 && listed) return;
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
            if (players != null && !listed) { listed = true; WriteList(players); }
            if (talk != null && players != null && !doneFactories.Contains(talk.Pointer))
            {
                doneFactories.Add(talk.Pointer);
                int added = 0;
                foreach (var (id, _) in Settings.Columns) if (AddRow(players, talk, id)) added++;
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
                foreach (var (id, width) in Settings.Columns)
                {
                    if (!known.Contains(id) || Has(list, Prefix + id)) continue;
                    list.Insert(at++, Column(template, Prefix + id, width > 0 ? width : widths.GetValueOrDefault(id, 60f)));
                    n++;
                }
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

        private readonly HashSet<string> known = new();
        private readonly Dictionary<string, float> widths = new();

        /// <summary>TeamTalk-columns.txt: every FM squad-table column that can be added.</summary>
        private static void WriteList(TableTemplate players)
        {
            try
            {
                var rows = players.RowDataList;
                var lines = new List<string> { "# Columns you can put in TeamTalk.cfg (FM's squad-table columns), with FM's default width.", "# Not all of them may work in the team talk table; try and see." };
                var ids = new List<string>();
                for (int i = 0; i < rows.Length; i++) ids.Add($"{rows[i].m_id} ({rows[i].m_defaultWidth:0})");
                ids.Sort(StringComparer.Ordinal);
                lines.AddRange(ids);
                File.WriteAllLines(System.IO.Path.Combine(Settings.Folder, "TeamTalk-columns.txt"), lines);
            }
            catch (Exception e) { Plugin.L.LogWarning("team talk: column list: " + e.Message); }
        }

        /// <summary>The team talk row's player for a squad-table path: binding.X becomes binding.Player.Person.X.</summary>
        private static string ForTalk(string path)
        {
            if (string.IsNullOrEmpty(path)) return path;
            if (path.Equals("team", StringComparison.OrdinalIgnoreCase)) return "binding.Team";
            if (path.Equals("binding", StringComparison.OrdinalIgnoreCase)) return "binding.Player.Person";
            if (path.StartsWith("binding.", StringComparison.OrdinalIgnoreCase)) return "binding.Player.Person." + path.Substring(8);
            if (path.StartsWith("team.", StringComparison.OrdinalIgnoreCase)) return "binding.Team." + path.Substring(5);
            return path;
        }

        /// <summary>Copies a squad-table column into the team talk table, fed by the row's player.</summary>
        private bool AddRow(TableTemplate from, TableTemplate to, string fromId)
        {
            string newId = Prefix + fromId;
            var rows = to.RowDataList;
            for (int i = 0; i < rows.Length; i++) if (rows[i].m_id == newId) { known.Add(fromId); return false; }
            TableTemplate.RowData src = null;
            var fromRows = from.RowDataList;
            for (int i = 0; i < fromRows.Length; i++) if (fromRows[i].m_id == fromId) { src = fromRows[i]; break; }
            if (src == null) { Plugin.L.LogWarning($"team talk: there is no FM column '{fromId}' (see TeamTalk-columns.txt)"); return false; }
            known.Add(fromId);
            widths[fromId] = src.m_defaultWidth;

            var row = src.MemberwiseClone().Cast<TableTemplate.RowData>();
            row.m_id = newId;
            row.m_sortBinding = new BindingPath(ForTalk(src.m_sortBinding?.m_path ?? ""));
            // FM's own value lists: "binding" now comes from the team talk row's player, "team" from its team
            row.m_valueBindings = Remaps(src.m_valueBindings, true);
            row.m_footerValueBindings = Remaps(src.m_footerValueBindings, false);
            var grown = new Il2CppReferenceArray<TableTemplate.RowData>(rows.Length + 1);
            for (int i = 0; i < rows.Length; i++) grown[i] = rows[i];
            grown[rows.Length] = row;
            to.m_rowData = grown;
            var lookup = to.m_rowDataLookup;
            if (lookup != null) lookup[newId] = row;
            return true;
        }

        private static Il2CppSystem.Collections.Generic.List<RemapInfo> Remaps(Il2CppSystem.Collections.Generic.List<RemapInfo> src, bool change)
        {
            var list = new Il2CppSystem.Collections.Generic.List<RemapInfo>();
            if (src == null) return list;
            // The interop's List<struct>.Add drops the value; FM's own Add, called through reflection, keeps it
            var add = list.GetIl2CppType().GetMethod("Add");
            for (int i = 0; i < src.Count; i++)
            {
                var m = src[i];
                if (change && m.to != null) m.to = new BindingPath(ForTalk(m.to.m_path));
                var args = new Il2CppReferenceArray<Il2CppSystem.Object>(1);
                args[0] = m;
                add.Invoke(list, args);
            }
            return list;
        }
    }
}
