<?php
// Builds a test course in this Moodle from a Curriculum AI course folder (imports/raw/<course>,
// the same folder scripts/import-course.mjs reads): one section per week with the course's files
// and pages, the test student and teacher enrolled, and a Curriculum AI activity at the top that
// opens the matching Curriculum AI course. Run it with setup-course.sh; running again replaces the course.

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/testing/generator/lib.php');

[$options] = cli_get_params(['dir' => '/tmp/course', 'shortname' => 'PBI-test', 'student' => '', 'teacher' => '', 'tool' => 'Curriculum AI']);
$dir = rtrim($options['dir'], '/');
$config = json_decode(file_get_contents("$dir/course.json"), true) ?: cli_error("No course.json in $dir");
$manifest = is_file("$dir/manifest.json") ? json_decode(file_get_contents("$dir/manifest.json"), true) : ['activities' => []];
$info = $config['course'];

\core\session\manager::set_user(get_admin());
$gen = new testing_data_generator();

// ---- The Curriculum AI tool: share name and email, open in a new window ----

$typeid = $DB->get_field('lti_types', 'id', ['name' => $options['tool'], 'state' => 1])
    ?: cli_error("No active external tool called \"{$options['tool']}\". Register and activate it first.");
foreach (['sendname' => 1, 'sendemailaddr' => 1, 'launchcontainer' => 4] as $name => $value) {   // 1 = always, 4 = new window
    if ($id = $DB->get_field('lti_types_config', 'id', ['typeid' => $typeid, 'name' => $name])) {
        $DB->set_field('lti_types_config', 'value', $value, ['id' => $id]);
    } else {
        $DB->insert_record('lti_types_config', (object) ['typeid' => $typeid, 'name' => $name, 'value' => $value]);
    }
}

// ---- The course, one section per week ----

if ($old = $DB->get_record('course', ['shortname' => $options['shortname']])) {
    delete_course($old, false);
    echo "Replaced the existing {$options['shortname']} course.\n";
}

$weekOf = [];
foreach ($info['topics'] as $t) $weekOf[$t['topic']] = $t['week'];
$weeks = max(array_merge([$info['total_weeks'] ?? 1], array_values($weekOf)));

$course = $gen->create_course([
    'fullname' => "{$info['name']} (test)",
    'shortname' => $options['shortname'],
    'category' => $DB->get_field_sql('SELECT MIN(id) FROM {course_categories}'),
    'format' => 'topics',
    'numsections' => $weeks,
    'summary' => "<p>A copy of {$info['name']} for testing Curriculum AI. Lecturers: " . s($info['lecturer']) . '.</p>',
    'summaryformat' => FORMAT_HTML,
], ['createsections' => true]);

for ($week = 1; $week <= $weeks; $week++) {
    $topics = array_keys(array_filter($weekOf, fn($w) => $w === $week));
    $section = $DB->get_record('course_sections', ['course' => $course->id, 'section' => $week]);
    course_update_section($course, $section, [
        'name' => "Week $week" . ($topics ? ': ' . implode(', ', $topics) : ''),
    ]);
}

// ---- Curriculum AI at the top ----

$gen->create_module('lti', [
    'course' => $course->id, 'section' => 0,
    'name' => 'Curriculum AI: your study companion',
    'intro' => '<p>Ask questions, practise topics and check your progress, with answers drawn from this course\'s materials.</p>',
    'showdescription' => 1,
    'typeid' => $typeid, 'toolurl' => '',
    'instructorcustomparameters' => "course={$info['code']}",
]);

// ---- Materials, in the week of their earliest topic ----

$added = 0;
foreach ($config['materials'] as $m) {
    $weeksOfTopics = array_map(fn($t) => $weekOf[$t] ?? 1, $m['topics'] ?: []);
    $week = $weeksOfTopics ? min($weeksOfTopics) : 1;
    $common = ['course' => $course->id, 'section' => $week, 'name' => $m['title'], 'intro' => '<p>' . s($m['type']) . '</p>', 'showdescription' => 1];

    if (!empty($m['file'])) {
        $path = "$dir/{$m['file']}";
        if (!is_file($path)) { cli_problem("Missing file, skipped: {$m['file']}"); continue; }
        $draftid = file_get_unused_draft_itemid();
        get_file_storage()->create_file_from_pathname([
            'contextid' => context_user::instance($USER->id)->id, 'component' => 'user', 'filearea' => 'draft',
            'itemid' => $draftid, 'filepath' => '/', 'filename' => preg_replace('/^\d+_+/', '', $m['file']),
        ], $path);
        $gen->create_module('resource', $common + ['files' => $draftid]);
    } else {
        // Text captured from the platform's own page, shown as a Moodle page.
        $text = '';
        foreach ($manifest['activities'] ?? [] as $a) if (($a['name'] ?? '') === ($m['manifestText'] ?? null)) $text = $a['text'] ?? '';
        if (!trim($text)) { cli_problem("No text, skipped: {$m['title']}"); continue; }
        $html = implode('', array_map(fn($p) => '<p>' . nl2br(s(trim($p))) . '</p>', preg_split('/\n\s*\n/', trim($text))));
        $gen->create_module('page', $common + ['content' => $html, 'contentformat' => FORMAT_HTML]);
    }
    $added++;
}

// ---- The test student and teacher ----

foreach (['student' => 'student', 'teacher' => 'editingteacher'] as $option => $role) {
    if (!$options[$option]) continue;
    $userid = $DB->get_field('user', 'id', ['username' => $options[$option], 'deleted' => 0])
        ?: cli_error("No Moodle user with username \"{$options[$option]}\".");
    $gen->enrol_user($userid, $course->id, $role);
    echo "Enrolled {$options[$option]} as $option.\n";
}

rebuild_course_cache($course->id, true);
echo "Created \"{$course->fullname}\" with $added materials in $weeks weeks: {$CFG->wwwroot}/course/view.php?id={$course->id}\n";
