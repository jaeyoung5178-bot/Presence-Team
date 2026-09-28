(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PresencePromotionCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var REQUIREMENTS = Object.freeze({
    TL: Object.freeze({ first: 2, total: 2 }),
    AOP: Object.freeze({ first: 3, total: 5 }),
    OP: Object.freeze({ first: 4, total: 10 })
  });
  var DEFAULT_GUIDE = Object.freeze({ bookings: 30, showups: 10, starters: 3, callsMin: 3, callsMax: 5 });
  var LEADER_ROLES = { LR: true, TL: true, AOP: true, OP: true, O: true };
  var ACTIONS = ['calling', 'confirmation', 'onboarding', 'coaching'];

  function normalizedName(name) { return String(name || '').replace(/\s+/g, '').toLowerCase(); }
  function isEligibleRole(role) { return !!LEADER_ROLES[String(role || '').toUpperCase()]; }
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var date = new Date(value + 'T00:00:00.000Z');
    return isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
  }
  function dateKey(date) { return date.toISOString().slice(0, 10); }
  function weekKey(value) {
    // Callers persist weeks under this Monday key; database rules validate dates, not weekdays.
    var date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
    if (!date || isNaN(date.getTime())) return null;
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return dateKey(date);
  }
  function integer(value, max) { return Number.isSafeInteger(value) && value >= 0 && value <= max; }
  function keysExactly(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).every(function (key) { return keys.indexOf(key) !== -1; }) &&
      keys.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); });
  }
  function validatePlan(input, today) {
    var errors = [];
    var p = input || {};
    var requirements = REQUIREMENTS[p.targetRole];
    var current = today instanceof Date ? dateKey(today) : (today || dateKey(new Date()));
    var start = parseDate(p.startDate), due = parseDate(p.due), now = parseDate(current);
    if (!requirements) errors.push('targetRole');
    if (!start || !due || !now || (start && due && start > due)) errors.push('dates');
    if (!integer(p.baselineFirstLeaders, 10000) || !integer(p.baselineTotalLeaders, 10000) || p.baselineFirstLeaders > p.baselineTotalLeaders) errors.push('baseline');
    if (!requirements || p.targetFirstLeaders !== requirements.first || p.targetTotalLeaders !== requirements.total) errors.push('targetCounts');
    if (typeof p.homeReminder !== 'boolean') errors.push('homeReminder');
    if (!keysExactly(p.guide, ['bookings', 'showups', 'starters', 'callsMin', 'callsMax']) ||
        !integer(p.guide && p.guide.bookings, 1000) || !integer(p.guide && p.guide.showups, 1000) ||
        !integer(p.guide && p.guide.starters, 1000) || !integer(p.guide && p.guide.callsMin, 100) ||
        !integer(p.guide && p.guide.callsMax, 100) || p.guide.callsMin > p.guide.callsMax ||
        p.guide.bookings < 1 || p.guide.showups < 1 || p.guide.starters < 1 || p.guide.callsMin < 1) errors.push('guide');
    return { valid: errors.length === 0, errors: errors, requirements: requirements || null };
  }
  function teamCounts(actor, activeUsers, dossierMap) {
    var ownName = normalizedName(actor && actor.name);
    var ownUid = actor && actor.uid;
    var users = Array.isArray(activeUsers) ? activeUsers : Object.values(activeUsers || {});
    var dossiers = dossierMap || {};
    var seenIds = {}, seenNames = {}, byName = {};
    users.forEach(function (user) {
      if (!user || !isEligibleRole(user.role) || user.status !== 'active' || !user.uid) return;
      var name = normalizedName(user.name);
      if (!name || name === ownName || user.uid === ownUid || seenIds[user.uid] || seenNames[name]) return;
      seenIds[user.uid] = true; seenNames[name] = true;
      byName[name] = user;
    });
    var firstLeaders = [], allLeaders = [];
    Object.keys(byName).forEach(function (name) {
      var user = byName[name];
      var dossier = dossiers[name] || {};
      var parent = normalizedName(dossier.upline);
      if (parent === ownName && ownName) firstLeaders.push(user);
      var seen = {};
      while (parent && !seen[parent]) {
        if (parent === ownName) { allLeaders.push(user); break; }
        seen[parent] = true;
        parent = normalizedName((dossiers[parent] || {}).upline);
      }
    });
    return { firstLeaders: firstLeaders, allLeaders: allLeaders, firstCount: firstLeaders.length, totalCount: allLeaders.length };
  }
  function countWeek(week) {
    return week && ['calls', 'bookings', 'showups', 'starters'].every(function (key) { return integer(week[key], 1000000); }) &&
      week.actions && ACTIONS.every(function (key) { return typeof week.actions[key] === 'boolean'; });
  }
  function calculate(plan, weeks, currentCounts, today) {
    var current = today instanceof Date ? dateKey(today) : (today || dateKey(new Date()));
    var check = validatePlan(plan, current);
    if (!check.valid) throw new Error('Invalid promotion plan: ' + check.errors.join(', '));
    var first = typeof currentCounts === 'number' ? currentCounts : currentCounts && currentCounts.firstCount;
    var total = typeof currentCounts === 'number' ? Math.max(currentCounts, plan.baselineTotalLeaders) : currentCounts && currentCounts.totalCount;
    if (!integer(first, 1000000) || !integer(total, 1000000) || first > total) throw new Error('Invalid current leader counts');
    var startWeek = weekKey(plan.startDate), endWeek = weekKey(current);
    var totals = { calls: 0, bookings: 0, showups: 0, starters: 0 };
    var records = weeks || {};
    Object.keys(records).forEach(function (key) {
      // Ignore non-Monday keys, including records created outside this planner.
      if (weekKey(key) !== key || key < startWeek || key > endWeek || !countWeek(records[key])) return;
      Object.keys(totals).forEach(function (metric) { totals[metric] += records[key][metric]; });
    });
    var firstGap = Math.max(0, plan.targetFirstLeaders - first);
    var totalGap = Math.max(0, plan.targetTotalLeaders - total);
    var initialFirstGap = Math.max(0, plan.targetFirstLeaders - plan.baselineFirstLeaders, firstGap);
    var targets = {
      bookings: initialFirstGap * plan.guide.bookings,
      showups: initialFirstGap * plan.guide.showups,
      starters: initialFirstGap * plan.guide.starters
    };
    var remaining = {};
    Object.keys(targets).forEach(function (metric) { remaining[metric] = firstGap === 0 ? 0 : Math.max(0, targets[metric] - totals[metric]); });
    var daysRemaining = Math.max(0, Math.floor((parseDate(plan.due) - parseDate(current)) / 86400000) + 1);
    var weeksRemaining = Math.ceil(daysRemaining / 7);
    var weekly = {};
    Object.keys(remaining).forEach(function (metric) { weekly[metric] = weeksRemaining ? Math.ceil(remaining[metric] / weeksRemaining) : 0; });
    weekly.callsMin = weekly.bookings * plan.guide.callsMin;
    weekly.callsMax = weekly.bookings * plan.guide.callsMax;
    var stages = {
      bookings: { current: totals.bookings, target: targets.bookings, remaining: remaining.bookings },
      showups: { current: totals.showups, target: targets.showups, remaining: remaining.showups },
      starters: { current: totals.starters, target: targets.starters, remaining: remaining.starters },
      firstLeaders: { current: first, target: plan.targetFirstLeaders, remaining: firstGap },
      totalLeaders: { current: total, target: plan.targetTotalLeaders, remaining: totalGap }
    };
    return {
      stages: stages, totals: totals, targets: targets, remaining: remaining, weekly: weekly,
      firstGap: firstGap, totalGap: totalGap, downstreamGap: Math.max(0, totalGap - firstGap),
      weeksRemaining: weeksRemaining, overdue: daysRemaining === 0,
      complete: firstGap === 0 && totalGap === 0,
      actionChecks: ACTIONS.reduce(function (result, action) {
        result[action] = !!(records[endWeek] && records[endWeek].actions && records[endWeek].actions[action]);
        return result;
      }, {})
    };
  }
  return { REQUIREMENTS: REQUIREMENTS, DEFAULT_GUIDE: DEFAULT_GUIDE, isEligibleRole: isEligibleRole,
    validatePlan: validatePlan, teamCounts: teamCounts, directLeaders: function (a, u, d) { return teamCounts(a, u, d).firstLeaders; },
    calculate: calculate, weekKey: weekKey, normalizedName: normalizedName };
});
