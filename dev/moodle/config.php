<?php  // Moodle settings for the Docker setup in this folder. Mounted into the container.
unset($CFG);
global $CFG;
$CFG = new stdClass();

$CFG->dbtype    = 'pgsql';
$CFG->dblibrary = 'native';
$CFG->dbhost    = 'db';
$CFG->dbname    = 'moodle';
$CFG->dbuser    = 'moodle';
$CFG->dbpass    = 'moodle';
$CFG->prefix    = 'mdl_';
$CFG->dboptions = ['dbpersist' => 0, 'dbport' => '', 'dbsocket' => ''];

// Moodle is only ever opened through ngrok, which handles HTTPS and passes plain HTTP on.
$CFG->wwwroot   = 'https://' . getenv('NGROK_DOMAIN');
$CFG->sslproxy  = true;

$CFG->dataroot  = '/var/www/moodledata';
$CFG->admin     = 'admin';
$CFG->directorypermissions = 02777;

require_once(__DIR__ . '/lib/setup.php');
