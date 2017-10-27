import * as mongodb from 'mongodb';
var passport = require('passport');

export function getNextSeq(db: mongodb.Db, cname: string): Promise<any> {
    let opts: mongodb.FindOneAndReplaceOption = {
        upsert: true,
        returnOriginal: false
    };
    let coll: mongodb.Collection = db.collection('counters');
    let fn = coll.findOneAndUpdate({ _id: cname }, { $inc: { seq: mongodb.Long.fromInt(1) } }, opts)
        .then(data => {
            return mongodb.Long.fromInt(data.value.seq);
        });
    return fn;
}

export function runningNo(db: mongodb.Db, cname: string, ref: string): Promise<any> {
    let opts: mongodb.FindOneAndReplaceOption = {
        upsert: true,
        returnOriginal: false
    };
    let coll: mongodb.Collection = db.collection('counters');

    let fn = coll.findOne({ _id: cname, ref: ref })
        .then(data => {
            if (!data) {
                return coll.findOneAndUpdate({ _id: cname }, { $set: { ref: ref, seq: 1 } }, opts);
            }
            return coll.findOneAndUpdate({ _id: cname, ref: ref }, { $inc: { seq: 1 } }, opts);
        })
        .then(data => {
            return data.value.seq;
        })
        .catch(err => { return err; });
    return fn;
}

export function getServiceType(code: string): number {
    switch (code) {
        case 'E':
            return 2572;
        case 'R':
            return 2639;
        case 'P':
            return 2579;
    }
    return null;
}

export function checkDuplicate(coll: mongodb.Collection, field: string, value: any): Promise<any> {
    let filter = {};
    filter[field] = { $regex: "^" + value + "$", $options: "i" };
    return coll.count(filter).then(count => {
        return count > 0;
    });
}

export function authenticate(req, res, next) {
    passport.authenticate('bearer', { session: false }, function (err, data, info) {
        if (err) {
            res.json({
                error: err
            });
        }
        else if (!data.user) {
            res.json({
                error: { message: 'Unauthorized.' }
            });
        }
        else {
            req['user'] = data.user;

            if (data.shop) {
                req['shop'] = data.shop;
            }

            next();
        }
    })(req, res, next);
}