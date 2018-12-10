//
// Copyright 2018 Dan Ruderman (dlruderman2gmail.com)
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

console.log('Loading db_loading.js')


// put the version string in there
document.getElementById("app-version").innerHTML = VERSION;
    


//
// Main app - just move on to the incident page
//
function main_app() {
    console.log("Running main app.");

    console.log(sessionStorage); // show what is stored

    window.location = "incident.html"; // proceed
}

if(db_sync_complete) {
    console.log("db sync already complete");
    main_app(); // start main app 
} else {
    console.log("awaiting db sync");
    sync_complete_callback = main_app;
}

