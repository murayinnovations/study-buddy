#!/bin/sh
# Builds the Moodle test course from a Study Buddy course folder (see setup-course.php).
# From this folder, with Moodle running:
#   sh setup-course.sh ../../imports/raw/pbi88 <student username> <teacher username>
set -e
[ -f "$1/course.json" ] || { echo "Usage: sh setup-course.sh <course folder> [student username] [teacher username]"; exit 1; }
docker compose exec -T moodle rm -rf /tmp/course /tmp/setup-course.php
docker compose cp "$1" moodle:/tmp/course
docker compose cp setup-course.php moodle:/tmp/setup-course.php
docker compose exec -T -u www-data moodle php /tmp/setup-course.php --dir=/tmp/course --student="$2" --teacher="$3"
docker compose exec -T moodle rm -rf /tmp/course /tmp/setup-course.php
