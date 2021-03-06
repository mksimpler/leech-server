'use strict';

const { MovieInfo } = require('../../models/types.js');
const leech = require('../leech-promise.js');

const NAME = '1pondo';
module.exports.name = function () {
    return NAME;
}

const TEMPLATE = {
    "search": "",
    "id": "https://www.1pondo.tv/movies/{qtext}/",
}

const DOMAIN = 'www.1pondo.tv';
module.exports.domain = function () {
    return DOMAIN;
}

const BASE_URL = 'https://' + DOMAIN;

function formatDuration (sec_num) {
    // val in seconds
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) { hours   = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }

    return hours + ':' + minutes + ':' + seconds;
}

function tryGetMovId (val) {
    let url = val;
    if (url.indexOf('www.1pondo.tv/movies/') > 0) {
        let p = url.split('/');
        return p[p.length - 2];
    }
    return null;
}

function crawlInternal (movid, url) {
    let templateURLs = [
        'https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/{movid}.json',
        'https://www.1pondo.tv/dyn/phpauto/movie_reviews/movie_id/{movid}.json',
    ]

    return Promise.all(
        templateURLs.map(t => {
            let u = t.replace('{movid}', movid);
            return leech.get({
                url: u,
                headers: {
                    'Referer': url
                }
            }).catch(err => null);
        })
    ).then($ => {
        let d_details = JSON.parse($[0]('body').text());

        let info = new MovieInfo({ url: url, country: 'Japan', origlang: 'Japanese' });

        info.title = '1Pondo ' + d_details["MovieID"];
        info.origtitle = d_details["Title"];

        info.releasedate = d_details["Release"];
        info.year = d_details["Year"];

        info.covers.push({
            url: d_details["ThumbHigh"]
        });

        info.thumb.push({
            url: d_details["MovieThumb"]
        })

        info.duration = formatDuration(d_details["Duration"]);

        info.description = d_details["Desc"];

        d_details["Actor"].split(',').forEach((text, i) => {
            let actor = {
                url: 'https://www.1pondo.tv/search/?a=' + d_details["ActorID"][i],
                text: text
            };

            info.actors.push(actor);
        });

        d_details["UCNAMEEn"].forEach((text, i) => {
            let genre = {
                url: 'https://www.1pondo.tv/search/?c=' + d_details["UC"][i],
                text: text
            };

            info.genres.push(genre);
        });

        info.maker = '一本道';

        if (d_details['Series']) {
            info.series = {
                url: 'https://www.1pondo.tv/search/?sr=' + d_details['SeriesID'],
                text: d_details['Series']
            }
        }

        if ($[1] != null) {
            try {
                let d_reviews = JSON.parse($[1]('body').text());
                info.rating = parseFloat(d_reviews["AvgRating"]) * 2;
            } catch (err) {
                // pass;
            }

        }

        return info;
    });
}

function crawl (opt) {
    let url = "";
    if (typeof opt == 'string') {
        url = opt;
    }

    if (typeof opt == 'object') {
        let qtext = opt.qtext || '';
        if (qtext) {
            url = TEMPLATE["id"].replace('{qtext}', qtext);
        }
    }

    if (url == "") {
        throw new Error("Invalid Arguments");
    }

    return new Promise((resolve, reject) => {
        leech.get(url)
        .then($ => {
            if ($('h1:contains("404 Not Found")').length > 0) {
                resolve(null);
            } else {
                let movid = tryGetMovId(url);
                crawlInternal(movid, url)
                    .then(info => resolve(info))
                    .catch(err => {
                        console.log(err)
                        reject(err)
                    });
            }
        })
        .catch(err => {
            var mss = err.message;
            if (mss.indexOf('HTTP Code') >= 0) {
                console.log('<' + mss + '> at ' + url)
                resolve(null);
            } else {
                reject(err);
            }
        });
    });
}

module.exports.crawl = crawl;
