# night-train-data

This repository provides a version of static data from the Back-on-Track night trains database which can be used for various purposes including the [night train map](https://back-on-track.eu/night-train-map/) on the BoT website.

Data is currently stored in a Google Sheets and this can be extracted as .json files for use with the night train map and other resources. 

A Google Apps script has been developed to extract the Google Sheets data, which can be found here: [code.gs](./scripts/code.gs).

A hosted version of the script is [here](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec) and can be used for one-off .json file creation.

## Night Train Map Web Application

This repository includes a React-based web application for filtering and visualizing night train trips on an interactive map.

### Features
- Search and select stations using autocomplete
- Filter trips by stations (shows complete trip if at least one station matches)
- Interactive map displaying filtered trips with routes and markers
- Responsive design for desktop and mobile

### Quick Start with Docker

To run the web application in production mode:

```bash
docker compose up -d
```

The application will be available at http://localhost/

For more details, see the [webapp README](./webapp/README.md).

## How to update the data held in this repository
There are several options for updating the data
1. For developers (mainly): If you are using git locally you can get update with this python script - [get_snapshot.py](./scripts/get_snapshot.py) which uses the currently hosted version of the script. Then create a pull request with the new files and they will get merged when approved, or if youv'e got the permissions and feeling brave, just commit.
2. Manual approach: Click the following links for the data you want:
- [view_ontd_map](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=view_ontd_map)
- [view_ontd_list](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=view_ontd_list)
- [agencies](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=agencies)
- [stops](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=stops)
- [routes](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=routes)
- [trips](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=trips)
- [trip_stop](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=trip_stop)
- [calendar](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=calendar)
- [calendar_dates](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=calendar_dates)
- [translations](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=translations)
- [classes](https://script.google.com/macros/s/AKfycbwY9zNQFq0urCHsTstWRKxLe0SstWrwyY04tSuDIVb_yRCtTs_HDlRARS-5fqltgEZr/exec?table=classes)

When you have the data, upload using the GitHub user interface.
For further details on using the GitHub user interface see this article: https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files