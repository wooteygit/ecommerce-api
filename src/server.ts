import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import * as logger from "morgan";
import * as path from "path";
import * as mongodb from 'mongodb';

import errorHandler = require("errorhandler");
import methodOverride = require("method-override");

var cors = require('cors');

import { Config } from './config';
import { OAuth2 } from './oauth2';

import { UserApi } from './api/user.api';

export class Server {
    public app: express.Express

    public static bootstrap(): Server {
        return new Server();
    };

    constructor() {
        this.app = express();

        this.config().then((db: mongodb.Db) => {
            new OAuth2(this.app, db);

            db.collection('users').createIndex('id', { name: 'pk', unique: true });

            this.api(db);
        });
    }

    public api(db: mongodb.Db) {
        let app = this.app;

        new UserApi(db, app);

        app.get('/version', (req, res) => {
            let v = Config.Version;
            res.json({ version: `${v.base}.${v.major}.${v.minor}` });
        });

        let server = app.listen(Config.Port, () => {
            console.log(`Listening on: ${Config.Host}:${Config.Port}` + ' at ' + new Date().toString());
        });
    }

    public config() {
        let app = this.app;

        app.use(cookieParser('ecommerce-api-dev'));
        app.use(bodyParser.json({ limit: '50mb' })); 
        app.use(cors());
        app.use(Config.FileDir, express.static('public'));

        app.use(function (req, res, next) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,PATCH,DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
            
            next();
        });

        let mongo = mongodb.MongoClient;
        return mongo.connect(Config.MongoUri);
    }
}