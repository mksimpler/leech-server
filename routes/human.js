'use strict';

const spider = require('../libs/spider.js');
const { HumanInfo, SearchResult } = require('../libs/types.js');
const cache = require('../config/cache.js');

const express = require('express');
const router  = express.Router();

router.get('/', function (req, res) {
    res.render('human/details', {
        // Default value for testing

        url: 'http://www.minnano-av.com/actress432853.html',

        photos: [
            'http://cdn.javmodel.com/javdata/uploads/tsubomi150.jpg'
        ],

        name: 'つぼみ',

        transname: 'つぼみ / Tsubomi',

        nicknames: [
            'つぼみん'
        ],

        aliases: [

        ],

        birthday: '1987-12-25',

        birthplace: 'Yamaguchi, Japan',

        bio: {
            tall: 160,
            bust: 84,
            cup: 'D',
            waist: 58,
            hip: 85,
            shoes: '',
            blood: 'O'
        },

        rating: {
            looks: 8.54,
            body: 8.46,
            cute: 8.7,
            fappable: 8.54,
            total: 8.57,
        },

        tags: [
            { text: '美乳', url: 'http://www.minnano-av.com/actress_list.php?tag_a_id=28' },
            { text: '色白', url: 'http://www.minnano-av.com/actress_list.php?tag_a_id=36' },
            { text: '美白', url: 'http://www.minnano-av.com/actress_list.php?tag_a_id=73' },
            { text: 'ロリ顔', url: 'http://www.minnano-av.com/actress_list.php?tag_a_id=2681' },
        ],

        // ...
    });
});

router.get('/search', function (req, res) {
    const type = 'human';
    var query = req.query['q'];

    var result = cache.get(type, query);
    if (result) {
        res.status(200).render('human/details', result);
    } else {
        spider.crawl(type, query)
        .then(data => {
            if (data instanceof SearchResult) {
                for (var info of data.results) {
                    var infoid = info.url.substring(info.url.lastIndexOf('/') + 1);
                    info["local-url"] = infoid;
                }
            }
            return data;
        })
        .then(data => {
            if (data instanceof HumanInfo) {
                cache.set(type, query, data);
                res.status(200).render('human/details', data);
            } else if (data instanceof SearchResult) {
                res.status(200).render('human/list', data);
            } else {
                res.status(404).end();
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).end();
        });
    }
});

router.get('/:infoid', function (req, res) {
    var asJson = req.query["json"];

    const type = 'human-id';
    var infoid = req.params['infoid'];

    var result = cache.get(type, infoid);
    if (result) {
        if (asJson) {
            res.status(200).json(result);
        } else {
            res.status(200).render('human/details', result);
        }
    } else {
        spider.crawl(type, infoid)
        .then(data => {
            if (data instanceof HumanInfo) {
                cache.set(type, infoid, data);
                if (asJson) {
                    res.status(200).json(data);
                } else {
                    res.status(200).render('human/details', data);
                }
            } else {
                res.status(404).end();
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).end();
        });
    }
});

module.exports = router;
