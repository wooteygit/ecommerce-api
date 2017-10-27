import * as mongodb from 'mongodb';
import * as crypto from 'crypto';
import * as request from 'request-promise';
import * as express from 'express';

import * as api from '../base-api';
import { Config } from '../config';
import { UserModel } from '../models/user.model';
import { ErrorModel } from '../models/error.model';

export class UserApi {
    private users: mongodb.Collection;
    private db: mongodb.Db;

    constructor(db: mongodb.Db, app: express.Express) {
        this.db = db;
        this.users = db.collection('users');

        app.get('/me', api.authenticate, (req, res) => {
            this.me(req, res);
        });
        app.post('/login', (req, res) => {
            this.logIn(req, res);
        });
        app.post('/signup', (req, res) => {
            this.signUp(req, res);
        });
    }

    private genRandomString(length: number): string {
        return crypto.randomBytes(Math.ceil(length / 2))
            .toString('hex')
            .slice(0, length);
    }

    private sha512(password: string, salt: string): any {
        var hash = crypto.createHmac('sha512', salt);
        hash.update(password);
        var value = hash.digest('hex');
        return {
            salt: salt,
            hash: value
        };
    };

    private createPassword(password: string): any {
        let salt: string = this.genRandomString(16);
        return this.sha512(password, salt);
    }

    me(req, res) {
        let fields = { _id: 0, id: 1, email: 1, fname: 1, lname: 1 };
        return this.users.find({ id: req.user.id }, fields).toArray().then(
            data => {
                res.json(UserModel.getUser(data[0]))
            }
        );
    }

    logIn(req, res) {
        let bd = req.body;
        request.post({
            url: `${Config.Host}:${Config.Port}/api/oauth/token`,
            json: true,
            body: {
                "grant_type": "password",
                "username": bd.email,
                "password": bd.password,
                "client_id": req.query.client_id,
                "client_secret": req.query.client_secret
            }
        }).then((result) => {
            res.json({
                "access_token": result.access_token
            });
        }).catch((err) => {
            if (err.statusCode == 401) {
                res.json(new ErrorModel(
                    "Authentication failed."
                ));
            }
            else {
                if (err.error.error && err.error.error.message) {
                    res.json(err.error);
                }
                else {
                    res.json(new ErrorModel(
                        `(${err.statusCode}) Unknown error.`
                    ));
                }
            }
        });
    }

    signUp(req, res) {
        let bd: any = req.body;
        let data: UserModel = {
            id: null,
            pwd: this.createPassword(bd.password),
            email: bd.email,
            fname: bd.first_name,
            lname: bd.last_name,
            cdate: mongodb.Long.fromNumber(new Date().getTime())
        };

        api.checkDuplicate(this.users, 'email', req.body.email)
            .then(dup => {
                if (dup) {
                    throw new ErrorModel(
                        "This email is already used."
                    );
                }
                else {
                    return api.getNextSeq(this.db, this.users.collectionName);
                }
            })
            .then(id => {
                data.id = id;
                return this.users.insert(data);
            })
            .then(() => res.json({ success: true }))
            .catch(err => {
                res.json(err);
            });
    }
}