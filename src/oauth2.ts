import * as mongodb from 'mongodb';
import * as express from 'express';

var passport = require('passport');
var methodOverride = require('method-override');
var oauth2orize = require('oauth2orize');
var crypto = require('crypto');
var passportHttp = require('passport-http');
var passportPassword = require('passport-oauth2-client-password');
var passportBearer = require('passport-http-bearer');

var BasicStrategy = passportHttp.BasicStrategy;
var ClientPasswordStrategy = passportPassword.Strategy;
var BearerStrategy = passportBearer.Strategy;

export class OAuth2 {
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

    constructor(app: express.Express, db: mongodb.Db) {
        var self = this;

        app.use(methodOverride());
        app.use(passport.initialize());

        var dbClients = db.collection('clients');
        var dbAccessTokens = db.collection('access_tokens');
        var dbRefreshTokens = db.collection('refresh_tokens');
        var dbUsers = db.collection('users');
        var dbShops = db.collection('shops');

        // var expires = 1;

        passport.use(new BasicStrategy(
            function (username, password, done) {
                dbClients.findOne({ id: username }, function (err, client) {
                    if (err) {
                        return done(err);
                    }

                    if (!client) {
                        return done(null, false);
                    }

                    if (client.secret !== password) {
                        return done(null, false);
                    }

                    return done(null, client);
                });
            }
        ));

        passport.use(new ClientPasswordStrategy(
            function (clientId, clientSecret, done) {
                dbClients.findOne({ id: clientId }, function (err, client) {
                    if (err) {
                        return done(err);
                    }

                    if (!client) {
                        return done({ message: 'Client not found.' });
                    }

                    if (client.secret !== clientSecret) {
                        return done({ message: 'Invalid client secret.' });
                    }

                    return done(null, client);
                });
            }
        ));

        passport.use(new BearerStrategy(
            function (accessToken, done) {
                dbAccessTokens.findOne({ token: accessToken }, function (err, token) {

                    if (err) {
                        return done(err);
                    }

                    if (!token) {
                        return done({ message: 'Invalid access token.' });
                    }

                    dbUsers.findOne({ _id: token.u_id }, function (err, user) {
                        if (err) {
                            return done(err);
                        }
                        if (!user) {
                            return done({ message: 'Unknown user.' });
                        }

                        var info = { scope: '*' };

                        dbShops.findOne({ uid: token.u_id }, function(err, shop) {
                            done(null, {
                                user: user,
                                shop: shop 
                            }, info);
                        });
                    });
                });
            }
        ));

        var generateTokens = function (data, done) {
            var errorHandler = function (cb, err) {
                if (err) {
                    return cb(err);
                }
            }.bind(undefined, done);

            dbRefreshTokens.remove(data, errorHandler);
            dbAccessTokens.remove(data, errorHandler);

            var tokenValue = crypto.randomBytes(32).toString('hex');
            var refreshTokenValue = crypto.randomBytes(32).toString('hex');

            var clone = function (obj) {
                if (null == obj || "object" != typeof obj) return obj;
                var copy = obj.constructor();
                for (var attr in obj) {
                    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
                }
                return copy;
            }

            data.created = mongodb.Long.fromNumber(Date.now());

            var accessToken = clone(data);
            accessToken.token = tokenValue;

            var refreshToken = clone(data);
            refreshToken.token = refreshTokenValue;

            dbRefreshTokens.save(refreshToken, errorHandler);
            dbAccessTokens.save(accessToken, function (err) {
                if (err) {
                    console.log(err);
                    return done(err);
                }
                // done(null, tokenValue, refreshTokenValue, {
                //     'expires_in': expires
                // });

                done(null, tokenValue, refreshTokenValue);
            });
        };

        var aserver = oauth2orize.createServer();
        aserver.exchange(oauth2orize.exchange.password(function (client, username, password, scope, done) {
            dbUsers.findOne({ email: username }, function (err, user) {
                if (err) {
                    return done(err);
                }

                if (!user) {
                    return done(new oauth2orize.TokenError(
                        null,
                        { message: 'Invalid username or password.' }
                    ));
                }

                var hashPassword = self.sha512(password, user.pwd.salt);
                if (!(hashPassword.hash === user.pwd.hash)) {
                    return done(new oauth2orize.TokenError(
                        null,
                        { message: 'Invalid username or password.' }
                    ));
                }

                dbAccessTokens.findOne({ u_id: user._id }, function (err, token) {
                    if (!token) {
                        var model = {
                            u_id: user._id,
                            id: client.id
                        };

                        generateTokens(model, done);
                    }
                    else {
                        done(null, token.token);
                    }
                });
            });

        }));

        aserver.exchange(oauth2orize.exchange.refreshToken(function (client, refreshToken, scope, done) {
            dbRefreshTokens.findOne({ token: refreshToken, id: client.id }, function (err, token) {
                if (err) {
                    return done(err);
                }

                if (!token) {
                    return done(null, false);
                }

                dbUsers.findOne({ _id: token.u_id }, function (err, user) {
                    if (err) {
                        return done(err);
                    }
                    if (!user) {
                        return done(null, false);
                    }

                    var model = {
                        u_id: user._id,
                        id: client.id
                    };

                    generateTokens(model, done);
                });
            });
        }));
        
        app.use('/api/oauth/token', [
            passport.authenticate(['basic', 'oauth2-client-password'], { session: false }),
            aserver.token(),
            aserver.errorHandler()
        ]);
    }
}