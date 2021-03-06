'use strict';

const { MovieInfo, SearchResult } = require('../../models/types.js');
const leech = require('../leech-promise.js');
const util = require('../util.js');
const dict = require('../category-dictionary.js');

const NAME = 'tokyo-hot';
module.exports.name = function () {
    return NAME;
}

const TEMPLATE = {
    "search": "https://my.tokyo-hot.com/product/?q={qtext}&lang={lang}",
    "id": "https://my.tokyo-hot.com/product/{qtext}/?lang={lang}",
}

const DOMAIN = 'my.tokyo-hot.com';
module.exports.domain = function () {
    return DOMAIN;
}

const BASE_URL = 'https://' + DOMAIN;

const LangMap = {
    'releasedate': { 'ja': '配信開始日', 'en': 'Release Date' },
    'duration': { 'ja': '収録時間', 'en': 'Duration' },
    'title': { 'ja': '作品番号', 'en': 'Product ID' },
    'actors': { 'ja': '出演者', 'en': 'Model' },
    'series': { 'ja': 'シリーズ', 'en': 'Theme' },
    'label': { 'ja': 'レーベル', 'en': 'Label' },
    'play': { 'ja': 'プレイ内容', 'en': 'Play' },
    'tags': { 'ja': 'タグ', 'en': 'Tags' },
}

function getFootprint (data) {
    return {
        "crawler": NAME,
        "id": data.movid,
    };
}

function formatMovID (val) {
    var p = val.split('product/');
    var pp = p[1].split('/');
    return pp[0];
}

function crawl (opt) {
    let url = "";
    let lang = "en";

    if (typeof opt == 'string') {
        url = opt;
    }

    if (typeof opt == 'object') {
        let type = opt.type || '';
        let qtext = opt.qtext || '';
        if (type && qtext) {
            url = TEMPLATE[type].replace('{qtext}', qtext);
        }

        lang = opt.lang || 'en'
        url = url.replace('{lang}', lang);

    }

    if (url == "") {
        throw new Error("Invalid Arguments");
    }

    return new Promise((resolve, reject) => {
        leech.get(url)
        .then($ => {
            if ($('.list.slider').length == 0 &&
                $('.infowrapper').length == 0) {
                resolve(null);

            } else {
                if ($('.list.slider').length > 0) {
                    // Search result
                    let result = new SearchResult( {
                        url: url,
                        footprint: getFootprint,
                    } );
                    result.queryString = $('#key').attr('value');
                    $('.list.slider li.detail').each((i, el) => {
                        let ele = $(el);
                        let info = new MovieInfo({
                            country: 'Japan',
                            origlang: 'Japanese',
                        });
                        info.movid = ele.find('a').attr('href').replace('/product/', '');
                        info.movid = info.movid.substring(0, info.movid.length - 1);
                        info.url = BASE_URL + '/product/' + info.movid + '/';
                        info.posters.push({
                            url: ele.find('img').attr('src')
                        });
                        info.title = 'Tokyo-Hot ' + ele.find('img').attr('title');
                        if (lang == 'en') {
                            info.transtitle = ele.find('.title').text();
                        }
                        if (lang == 'ja') {
                            info.origtitle = ele.find('.title').text();
                        }
                        result.results.push(info);
                    });
                    result.more = $('div.navi').length > 0;

                    resolve(result);
                } else {
                    let info = new MovieInfo({
                        url: url,
                        country: 'Japan',
                        origlang: 'Japanese',
                    });
                    info.movid = formatMovID(url);
                    var title = $(`.infowrapper dt:contains("${LangMap['title'][lang]}")`)
                        .next().text();
                    info.title = 'Tokyo-Hot ' + title;
                    var jacket = $('.package a').first().attr('href') || ''
                    if (jacket.indexOf('jacket') > -1) {
                        info.covers.push({
                            url: jacket,
                        });
                    } else {
                        info.covers.push({
                            url: $('video').attr('poster'),
                        });
                    }
                    info.thumb.push({
                        url: `http://my.cdn.tokyo-hot.com/media/${info.movid}/package/_v.jpg`
                    })
                    if (lang == 'ja') {
                        info.origtitle = $('.contents > h2').text();
                    }
                    if (lang == 'en') {
                        info.transtitle = $('.contents > h2').text();
                    }
                    info.description = $('.contents > .sentence').text().trim();
                    info.releasedate = util.replaceAll(
                        $(`.infowrapper dt:contains("${LangMap['releasedate'][lang]}")`)
                            .next().text(),
                        '/', '-'
                    );
                    info.year = info.releasedate.substring(0, 4);
                    info.duration = $(`.infowrapper dt:contains("${LangMap['duration'][lang]}")`)
                        .next().text();

                    $(`.infowrapper dt:contains("${LangMap['actors'][lang]}")`)
                        .next().find('a').each((i, el) => {
                            let ele = $(el);
                            let actor = {
                                url: BASE_URL + ele.attr('href'),
                                text: ele.text(),
                            }
                            info.actors.push(actor);
                        });

                    var ele = $(`.infowrapper dt:contains("${LangMap['series'][lang]}")`)
                        .next().find('a');
                    if (ele.length > 0) {
                        info.series = {
                            url: BASE_URL + ele.attr('href'),
                            text: ele.text(),
                        };
                    }

                    $(`.infowrapper dt:contains("${LangMap['play'][lang]}")`)
                        .next().find('a').each((i, el) => {
                            let ele = $(el);
                            let genre = {
                                url: BASE_URL + ele.attr('href'),
                                text: util.formatProperCase(
                                    dict('ja', ele.text())
                                ),
                            }
                            info.genres.push(genre);
                        });

                    $(`.infowrapper dt:contains("${LangMap['tags'][lang]}")`)
                        .next().find('a').each((i, el) => {
                            let ele = $(el);
                            let genre = {
                                url: BASE_URL + ele.attr('href'),
                                text: util.formatProperCase(
                                    dict('ja', ele.text())
                                ),
                            }
                            info.genres.push(genre);
                        });

                    info.maker = 'TOKYO-HOT';

                    var ele = $(`.infowrapper dt:contains("${LangMap['label'][lang]}")`)
                        .next().find('a');
                    if (ele.length > 0) {
                        info.label = {
                            url: BASE_URL + ele.attr('href'),
                            text: ele.text(),
                        };
                    }

                    resolve(info);
                }
            }
        })
        .catch(err => util.catchURLError(url, err, resolve, reject));
    });
}

module.exports.crawl = crawl;
