//
// Copyright 2018 Dan Ruderman (dlruderman@gmail.com)
//
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU Affero General Public License as published
//    by the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU Affero General Public License for more details.
//
//    You should have received a copy of the GNU Affero General Public License
//    along with this program.  If not, see https://www.gnu.org/licenses/.
//

const VERSION = "v0.4b"; // software version

const TEST_MODE = false; // true means all messages and statuses will be prepended with "TEST: "

const ADMIN_EMAIL = ""; // fill this in with the email contact for credentials requests

const RUN_LOCATION = "local";

if(RUN_LOCATION == "my-install") {
    var TILE_SERVER = 'http://<host>:8080/styles/klokantech-basic/{z}/{x}/{y}.png'; // set <host> to your tile server
    var TILE_SERVER_OPTS = {
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
	    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
	    'Server courtesy of <a href="https://openmaptiles.com/">OpenMapTiles</a>'
    };
    var DEFAULT_DB_HOST = '<host>'; // set <host> to your CouchDB server
    var LOCAL_DB_NAME = 'emcommap';
} else if(RUN_LOCATION=="local") {
//
// For running on local computer with internet access to external tile server
//
    var TILE_SERVER = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
    var TILE_SERVER_OPTS = {
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
	    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
	    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
	id: 'mapbox.streets'
    };
    var DEFAULT_DB_HOST = window.location.hostname;
    var LOCAL_DB_NAME = 'emcommap_testing';
} else if(RUN_LOCATION=="aws") {
    // this is proxied through port 8899 which has a CORS proxy
    var TILE_SERVER = 'http://' + window.location.hostname + ':8899/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
    var TILE_SERVER_OPTS = {
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
	    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
	    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
	id: 'mapbox.streets'
    };
    var DEFAULT_DB_HOST = window.location.hostname;
    var LOCAL_DB_NAME = 'emcommap_aws';
} else {
    alert("Bad configuration specification: " + RUN_LOCATION);
}

const DEFAULT_DB_PORT = '5984'; // 5984=couchDB

const REMOTE_DB_NAME = 'emcommap';
const ATTACHMENT_DB_NAME = 'emcommap_attachments';
const MAX_ATTACHMENT_SIZE_MB = 10; // This is the maximum size of a file attachment.

const RUN_LOCAL_LOCAL_DB_NAME = "emcommap_local"; // this is name of local database if not connected to remote

// names of session storage
const TACTICAL_CALL_ID = 'emcommap.tactical_call';
const USERNAME_ID = 'emcommap.username';
const PASSWORD_ID = 'emcommap.password';
const CURRENT_INCIDENT_ID = 'emcommap.current_incident';
const DB_HOST_ID = 'emcommap.dbhost';
const DB_PORT_ID = 'emcommap.dbport';
const MAP_SERVER_ID = 'emcommap.map_server_url';
const RUN_TYPE_ID = 'emcommap.run_type';
const RUN_TYPE_STANDALONE = 'standalone';
const RUN_TYPE_REMOTE = 'remote';

