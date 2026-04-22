import passport, { PassportStatic } from 'passport';

import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import {Strategy as AppleStrategy} from 'passport-apple';
import { AuthRepo } from './repo/app/auth.repo';
import { Shopper } from './models/account/shopper';
import { ShopperRepo } from './repo/ecommerce/shopper.repo';


export class Passport {

  public static async loadPassport(passport: PassportStatic) {
    try {
      passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true,


      },
        async function (req, username, password, done) {
          try {
            let shopper = new Shopper();

            shopper.phone = username;
            shopper.password = password;
            shopper.provider = 'local';

            // let shopperData = await ShopperRepo.findAndSave(    shopper.phone )
            // if(shopperData)
            // {
            //   if (shopperData.success) {
            //     done(null, shopperData.data)
            //   } else {
            //     done(null,false,{message:shopperData.msg})
            //   }
            // }
            done(null, false, { message: "Shopper Not Found " })
          } catch (error) {

            done(error)
          }


        }
      )); 


      passport.use(
        new GoogleStrategy({
          clientID: process.env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          callbackURL: process.env.GOOGLE_CALLBACK_URL, //env
        },
          async function (accessToken, refreshToken, profile, cb) {

            let shopper
            // save shopper and return
            try {
              if (profile) {

                 shopper = new Shopper()
                if (profile.emails) {
                  let email = "";
                  try {
                    email = profile.emails[0].value
                  } catch (error) { }
                  shopper.providerKey = profile.id;
                  shopper.provider = 'Google';
                  let shopperName = profile.name?.givenName ??profile.displayName
                  shopper.name = shopperName 
                  shopper = await ShopperRepo.insertShopper(shopper)
                }
                
            
              }
              if (shopper) {
                return cb(null, shopper);
              } else {
                return cb("", false);
              }

            } catch (err) {
              return cb(err, false);
            }
          }
        )
      );
      passport.use(
        new GoogleStrategy({
          clientID: process.env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          callbackURL: process.env.GOOGLE_CALLBACK_URL, //env
        },
          async function (accessToken, refreshToken, profile, cb) {

            let shopper
            // save shopper and return
            try {
              if (profile) {

                 shopper = new Shopper()
                if (profile.emails) {
                  let email = "";
                  try {
                    email = profile.emails[0].value
                  } catch (error) { }
                  shopper.providerKey = profile.id;
                  shopper.provider = 'Google';
                  let shopperName = profile.name?.givenName ??profile.displayName
                  shopper.name = shopperName 
                  shopper = await ShopperRepo.insertShopper(shopper)
                }
                
            
              }
              if (shopper) {
                return cb(null, shopper);
              } else {
                return cb("", false);
              }

            } catch (err) {
              return cb(err, false);
            }
          }
        )
      );

      passport.use(
        new AppleStrategy({
                clientID: process.env.APPLE_CLIENT_ID??"", //env
                teamID: process.env.APPLE_TEAMID??"",
                callbackURL: process.env.APPLE_CALLBACK_URL??"", //env
                keyID: process.env.APPLE_KEYID??"",
              
                scope: ["name", "email"],
                passReqToCallback: true,
            },
            async function(req, accessToken, refreshToken, idToken, profile, cb) {
                try {
                    let name;
                  let  shopper = new Shopper()
                    try {
                        name = profile.name.firstName + " " + profile.name.lastName;
                    } catch (error) {
                        name = profile.email.substring(0, profile.email.indexOf('@'));
                    }
  
                    shopper.name = name;
                    shopper.email = profile.email
                    shopper.providerKey = profile.id;
                    shopper.provider = 'Apple';
                    shopper = await ShopperRepo.insertShopper(shopper)

                    return cb(null, shopper);
                } catch (err:any) {
                  return cb(err);
                }
            }
        )
    );



      passport.serializeUser((user, cb) => {
        cb(null, user);
      });

      passport.deserializeUser((user: any, cb) => {
        cb(null, user);
      })
    } catch (error: any) {


    }

  }

}