import { TabsPage } from './../tabs/tabs';
import { Component } from '@angular/core';
import { NavController, NavParams, AlertController, LoadingController } from 'ionic-angular';
import { WiztalkHelper } from '../../providers/WiztalkHelper';
import { Http, Headers, RequestOptions } from '@angular/http';

@Component({
  selector: 'page-sms-verification',
  templateUrl: 'sms-verification.html',
})
export class SmsVerificationPage {

  vcode;
  pageType:string = 'verify_code';
  phoneNumber;
  userData;
  token:any;
  mainApiToken;
  chanceResend: number = 2;
  loadingEle;

  constructor(public navCtrl: NavController, public navParams: NavParams, public alertCtrl: AlertController,
    public helper: WiztalkHelper, public loading: LoadingController, public http: Http) {

    this.userData     = navParams.get('user');
    this.phoneNumber  = this.userData.phone;
    this.token        = navParams.get('token');
    this.mainApiToken = navParams.get('mainApiToken');

  }

  ionViewDidLoad() {
  }

  enablePage( pageType: string ) {
    this.pageType = pageType;
  }

  private getHeaderAuth(): any {
    var headers = new Headers();
    headers.append("Accept", 'application/json');
    headers.append('Content-Type', 'application/json');

    return new RequestOptions({ headers: headers });
  }


  getChanceResend() {

    if( this.chanceResend <= 0 ) {
      return '';
    } else {
      return '('+ this.chanceResend +')';
    }
    
  }

  resendCodeVerification() {

    if( this.chanceResend <= 0 ) {
      this.showAlert( 'Opps', 'You already used 2 resend chance. Please re-log again.' );
    } else {
      
      this.chanceResend = this.chanceResend - 1;
      this.sendMainApiOTP();

    }

  }

  sendMainApiOTP() {

    this.loadingEle = this.loading.create({
      content: 'Please wait...'
    });
    
    this.loadingEle.present();

    var headers = new Headers();
    headers.append("Authorization", 'Bearer ' + this.mainApiToken);
    headers.append('Content-Type', 'application/json' );
    headers.append('Accept', 'application/json' );

    let data= {"phoneNum": this.userData.phone, "digit": 4};
    this.http.put( this.helper.urlMainApi + '/smsotp/1.0.1/otp/' + this.userData.id, JSON.stringify(data), { headers: headers }).map(res => {
      return res.json()})
    .subscribe(data => {
      
      this.loadingEle.dismiss();

      if( data.status ) {
        this.showAlert( 'Success', 'We have sent you a message.' );
      } else {
        this.showAlert( 'Opps', 'Problem while sending message.' );
      }

    }, error => {

      this.loadingEle.dismiss();
      this.showAlert('Opps', 'It seem we can send you a message. Make sure you input the right number');
      console.log( error );
    }); 
    
  }

  activateUser() {

    var headers = new Headers();
    headers.append("Accept", 'application/json');
    headers.append('Content-Type', 'application/json' );
    headers.append('Authorization','Bearer '+ this.token );
    let options = new RequestOptions({ headers: headers });

    this.http.get( this.helper.url+"/verify/"+ this.userData.activation_code, options )
    .map(res =>{
      return res.json();
    }).subscribe( data => {
      
      this.loadingEle.dismiss();
      this.showAlert( 'Congratulations', 'Your account has been activated successfully.' );
      
      localStorage.setItem("token", this.token);
      localStorage.setItem("user", JSON.stringify(this.userData));
      this.navCtrl.push(TabsPage, {index : 0});
      
    }, error=>{
      console.log( error );
    }); 

  }

  verifyCode() {

    this.chanceResend = this.chanceResend - 1;
    this.loadingEle = this.loading.create({
      content: 'Please wait...'
    });
    
    this.loadingEle.present();

    var headers = new Headers();
    headers.append("Authorization", 'Bearer ' + this.mainApiToken);
    headers.append('Content-Type', 'application/json' );
    headers.append('Accept', 'application/json' );

    let data= {"otpstr": this.vcode, "digit": 4};
    this.http.post( this.helper.urlMainApi + '/smsotp/1.0.1/otp/'+ this.userData.id +'/verifications', JSON.stringify(data), { headers: headers }).map(res => {
      return res.json()})
    .subscribe(data => {
      
      if( data.status ) {

        this.activateUser();
        
      } else {
        this.loadingEle.dismiss();
        this.showAlert( 'Opps', data.message );
      }

    }, error => {

      this.loadingEle.dismiss();
      this.showAlert('Opps', 'It seem we can send you a message. Make sure you input the right number');
      console.log( error );
    }); 

  }

  sendVerificationCode() {
    
    this.loadingEle = this.loading.create({
      content: 'Updating phone number...'
    });

    this.loadingEle.present();

    let sosmedUser: any = { 'email': this.userData.email, 'phone': this.phoneNumber };
    let dataLogin: any = [];
    let options = this.getHeaderAuth();

    this.http.post(this.helper.url + "/auth/updatephone", sosmedUser, options)
    .map(res => {
      return res.json()
    })
    .subscribe(data => {
      
      this.loadingEle.dismiss();

      dataLogin       = data.data;
      this.userData   = dataLogin;
      this.sendMainApiOTP();
      this.pageType = 'verify_code';
      
    }, error => {

      this.loadingEle.dismiss();
      this.showAlert('Error', 'Failed to updating phone number');
      console.log( error );
      
    }); 

  }

  showAlert( titleAlert, message ) {

    let alert = this.alertCtrl.create({
      title: titleAlert,
      subTitle: message,
      buttons: ['OK']
    });
    
    alert.present();

  }

}
