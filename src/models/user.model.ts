import * as mongodb from 'mongodb';

class Password {
    salt: string;
    hash: string;
}

export class UserModel {
    id?: number; // id
    fname?: string; // first_name
    lname?: string; // last_name
    pwd?: Password; // first_name
    email?: string; // email
    cdate?: mongodb.Long; // create_date
    edate?: mongodb.Long; // edit_date
    atv?: boolean; // activated

    static getUser?(data: UserModel): any {
        let u: any = {};

        if (data.id != null) u.id = data.id;
        if (data.email != null) u.email = data.email;
        if (data.fname != null) u.first_name = data.fname;
        if (data.lname != null) u.last_name = data.lname;
        if (data.cdate != null) u.create_date = new Date(data.cdate);
        if (data.edate != null) u.edit_date = new Date(data.edate);
        if (data.atv != null) u.activated = data.atv;
        
        return u;
    }
}