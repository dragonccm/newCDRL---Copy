const express = require('express');
const router = express.Router();
const { getNameGlobal } = require('../lib/mogodb_lib');
const name_global_databases = getNameGlobal();
const publicKey = process.env.PUBLIC_KEY;
require('dotenv').config();
function createLoginRouter(client) {
    // login route
    router.get('/', async (req, res) => {
        const user = req.session.user;
        console.log('hahahah');
        if (user) {
            return res.redirect('/');
        }
        return res.render('global-login', {
            header: 'global-header',
            thongbao: 'global-notifications',
            footer: 'global-footer',
            avt: null,
            secretKey: publicKey,
        });
    });
    // firstlogin route
    router.get('/firstlogin', async (req, res) => {
        const user = req.session.user;
        let tile = 'Đăng nhập lần đầu';
        if (req.query.tile == 'ok') {
            tile = 'Cập nhật mật khẩu';
        }
        if (!user?.first) {
            return res.redirect('/');
        }
        return res.render('global-first-login', {
            header: 'global-header',
            thongbao: 'global-notifications',
            footer: 'global-footer',
            avt: null,
            logout: true,
            tile: tile,
            secretKey: publicKey,
        });
    });
    return router;
}
module.exports = createLoginRouter;
