import { Component, OnInit } from '@angular/core';
import { NavController, NavParams, AlertController, Tabs } from 'ionic-angular';
import { Http, Headers, RequestOptions } from '@angular/http';
import { InAppBrowser, InAppBrowserOptions } from "@ionic-native/in-app-browser";
import { GoogleAnalytics } from '@ionic-native/google-analytics';

import { WiztalkHelper } from '../../providers/WiztalkHelper';
import { TabsPage } from '../tabs/tabs';
import { PaymentinfoPage } from '../paymentinfo/paymentinfo';
import { LoadingController } from 'ionic-angular/components/loading/loading-controller';

@Component({
  selector: 'page-payment',
  templateUrl: 'payment.html'
})

export class PaymentPage implements OnInit{

    package : any;
    banks: any = [];
    bankId:any;
    bank:any;
    discount:any;
    shown:boolean = false;
    responseStatus:any;
    errorMessage:any;
    paymentCounter:any;
    options:any;
    paymentValue:any;
    paymentValueInDollar: any;
    discountValue:any;
    price;
    user: any;
    productName;

    finalAmount;
    additionalPercentCost: number = 3.5;
    additionalCostFee: number     = 2500;
    
    /** 
     * ( ( 95000 x 100 ) / (100-3.5) ) + 2500
    */
    idActiveState: number;
    paymentType: string = 'transfer';

    mainApiToken;

    userPackage = { "package_id" : "","session_complete" : 0, "session_available" : 0, "payment_status" : 0, "payment_amount" : 0,
                   "status" : 0, "payment_method" : 1, "bank_id" : "", "voucher_id" : "", "voucher_value": 0};

    transactionDetails = {
      "amount"      : "",
      "cardNumber" : "",
      "expm" : "",
      "expy" : "",
      "ccv" : ""
    };
    
    // this.http.get(this.helper.url+"/payment/paypal/nominal", this.userPackage , options)
  constructor(public navCtrl: NavController,
              private paket : NavParams,
              public http : Http,
              public alertCtrl : AlertController,
              public helper : WiztalkHelper,
              private iab: InAppBrowser,
              public loadingCtrl: LoadingController,
              public ga: GoogleAnalytics
            ) {

      this.productName = paket.get('product_name') + ' ' + paket.data.paket.name;
      console.log( this.productName );

      this.ga.startTrackerWithId('UA-110675684-1')
      .then(() => {
  
          this.ga.trackView('Choose Payment');
      })
      .catch(e => console.log('Error starting GoogleAnalytics', e));
   }

  ngOnInit() {
    let token = localStorage.getItem("token");
    var headers = new Headers();
    headers.append("Accept", 'application/json');
    headers.append('Content-Type', 'application/json' );
    headers.append('Authorization','Bearer '+token);
    let options = new RequestOptions({ headers: headers });

    this.options = options;
    this.package = this.paket.get("paket");
    this.price = this.paket.get("finalPrice");

    this.http.get(this.helper.url+"/banks", options)
    .map(res =>{
      return res.json();
    }).subscribe( data => {
        this.banks = data.data;
    })    
  }

  choosePayment(bank, paymentType){
  
    this.idActiveState = bank.id;
    this.bank = bank;
    this.paymentType = paymentType;

    this.http.get(this.helper.url+"/payments/counter/"+this.bank.id, this.options)
    .map(res =>{
      return res.json();
      
    }).subscribe( data => {
      
        this.paymentCounter = data.counter;
        this.paymentValue   = this.price + this.paymentCounter;
        this.shown = true;

        // Manual convert currency to dolla
        // This is naive method and should be replace
        let dollar = this.paymentValue / 13400;
        this.paymentValueInDollar = dollar.toFixed(2);
        
    }) ;

  }

  confirmPayment(){

    this.userPackage.package_id         = this.package.id;
    this.userPackage.bank_id            = this.bank.id;
    this.userPackage.session_available  = this.package.session;
    this.userPackage.session_complete   = 0;
    
    this.userPackage.payment_amount = this.paymentValue;
    this.userPackage.payment_method = 1; // 1 for bank, 2 for credit card, 3 paypal
    this.userPackage.payment_status = 0; // 1 == paid
    this.userPackage.status         = 0; // 1 == bisa bikin schedule

    if(this.discount === undefined) {
      this.userPackage.voucher_value = 0;
      
    } else {

      this.userPackage.voucher_id     = this.discount.id;
      this.userPackage.voucher_value  = this.discount.voucher_value;
    } 

    if( this.paymentType === 'cc' ) {
      
      let alert = this.alertCtrl.create({
        title: 'Additional Cost',
        subTitle: 'You choose payment by credit card and it will add additional cost. Is it Okay?',

        // START BUTTON CHOICE
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Ok',
            handler: () => {

              this.startConversiMidtrans();

            } // END HANDLER BUTTON
          }
        ]
        // END BUTTON CHOICE

      });
      // END ALERT DIALOG

      alert.present();
    }

    if( this.paymentType === 'transfer' ) {

      this.transferPayment();
    }

    if( this.paymentType === 'paypal' ) {

      let alert = this.alertCtrl.create({
        title: 'Additional Cost',
        subTitle: 'You choose payment by PayPal and it will add additional cost. Is it Okay?',

        // START BUTTON CHOICE
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Ok',
            handler: () => {

              this.startConversiPaypal();

            } // END HANDLER BUTTON
          }
        ]
        // END BUTTON CHOICE

      });
      // END ALERT DIALOG

      alert.present();

    }
 
  }

  showAlert(a) {
    
    let alert = this.alertCtrl.create({
      subTitle: a,
      buttons: ['OK']
    });
    alert.present();

  }

  startConversiPaypal() {

    // this.http.get(this.helper.url+"/payment/paypal/nominal", this.userPackage , options)
    
    let loading = this.loadingCtrl.create({
      content: 'Proccessing...'
    });

    loading.present();

    let token   = localStorage.getItem("token");
    var headers = new Headers();
    
    headers.append("Accept", 'application/json');
    headers.append('Content-Type', 'application/json' );
    headers.append('Authorization','Bearer '+token);
    
    let options = new RequestOptions({ headers: headers });

    this.http.get(this.helper.url+"/payment/paypal/" + this.paymentValue, options)
    .map(res =>{
      return res.json();
      
    }).subscribe( data => {
      
      loading.dismiss();
      this.paymentValueInDollar = data.paypal;
      this.userPackage.payment_amount = this.paymentValueInDollar;
      this.payPalPayment();
        
    }) ;

  }

  startConversiMidtrans() {
    
    let loading = this.loadingCtrl.create({
      content: 'Proccessing...'
    });

    loading.present();

    let token   = localStorage.getItem("token");
    var headers = new Headers();
    
    headers.append("Accept", 'application/json');
    headers.append('Content-Type', 'application/json' );
    headers.append('Authorization','Bearer '+token);
    
    let options = new RequestOptions({ headers: headers });

    this.http.get(this.helper.url+"/payment/midtrans/" + this.paymentValue, options)
    .map(res =>{
      return res.json();
      
    }).subscribe( data => {
      
      loading.dismiss();
      let hasilConversi = data.midtrans;
      
      this.transactionDetails.amount = parseInt(hasilConversi).toFixed(0);
      this.userPackage.payment_amount = parseInt( this.transactionDetails.amount );
      this.snapPayment();        

    });

  }

  payPalPayment() {

    // Create query params for user detail
    this.user = JSON.parse(localStorage.getItem("user"));
    let userParams = 'email=' + this.user.email + '&name=' + this.user.username + '&phone=' + this.user.phone + '&package_id=' + this.userPackage.package_id + '&package_name=' + this.productName;
    
    const options: InAppBrowserOptions = {
      zoom: 'yes',
      location: 'no',
      hardwareback: 'no'
    }
    
    // Opening a URL and returning an InAppBrowserObject
    const browser2 = this.iab.create( this.helper.urlApiPaypal + '?amount=' + this.paymentValueInDollar + '&' + userParams, '_blank', options);

      browser2.on('loadstart').subscribe((event) =>{

        // PAYMENT FAILED
        if (event.url.match("payment/mobile/closeWindow")) {
          
          browser2.close();
        }

        // PAYMENT FAILED
        if (event.url.match("payment/mobile/closeFail")) {
          
          browser2.close();
          this.showAlert('Payment failed. Please select another payment method');
        }          

        // PAYMENT SUCCESS
        if (event.url.match("payment/mobile/closeOk")) {

          this.ga.trackEvent('package', 'payment success', 'PayPal', this.paymentValueInDollar)
          .then(() => {
          });

          browser2.close();
          let loading = this.loadingCtrl.create({
            content: 'Updating package status...',
            dismissOnPageChange: true
          });

          loading.present();

          this.userPackage.payment_method = 3; // 1 for bank, 2 for credit card, 3 paypal
          this.userPackage.payment_status = 1; // 1 == paid
          this.userPackage.status         = 1; // 1 == bisa bikin schedule
          this.userPackage.session_complete   = 0;
    
          console.log( this.userPackage );
          // BECAUSE THE PAYMENT WAS SUCCESS
          // REGISTER PACKAGE WITH ALL STATUS 1
          let token   = localStorage.getItem("token");
          var headers = new Headers();
          
          headers.append("Accept", 'application/json');
          headers.append('Content-Type', 'application/json' );
          headers.append('Authorization','Bearer '+token);
          
          let options = new RequestOptions({ headers: headers });
          
          this.http.post(this.helper.url+"/package/register", this.userPackage , options)
          .map(res => {
            
              this.responseStatus = res.status;
              return res.json()})
          .subscribe(data => {
      
            this.navCtrl.push(TabsPage, { index: 3 }).then(() => {
              
              // Clear the payment info page from view stack
              // Why I do this? because I dont want to after system direct to index 3,
              // and user press back button it direct back to payment info page.
              const index = this.navCtrl.getActive().index;
              this.navCtrl.remove(0, index);
              var t: Tabs = this.navCtrl.parent;
              t.select(3);
              
            });
              
          }, error => {

              loading.dismiss();
              this.responseStatus = error.status;
              this.errorMessage = error.json().error;
              this.showAlert(this.errorMessage);
          
          });
          // END REGISTER

          
        }

      });
  }

  snapPayment() {
    
    // Create query params for package
    let params = new URLSearchParams();
    for(let key in this.transactionDetails){
        params.set(key, this.transactionDetails[key]) 
    }

    // Create query params for user detail
    this.user = JSON.parse(localStorage.getItem("user"));
    let userParams = 'email=' + this.user.email + '&name=' + this.user.username + '&phone=' + this.user.phone + '&package_id=' + this.userPackage.package_id + '&package_name=' + this.productName;

    const options: InAppBrowserOptions = {
      zoom: 'yes',
      location: 'no',
      hardwareback: 'no'
    }

    console.log( this.helper.urlApiSnap + '?' + params.toString() + '&' + userParams );
    // Opening a URL and returning an InAppBrowserObject
    const browser = this.iab.create( this.helper.urlApiSnap + '?' + params.toString() + '&' + userParams, '_blank', options);

    browser.on('loadstart').subscribe( (event) => {
      
      // User close the browser
      if (event.url.match("mobile/closeWindow")) {
        
        browser.close();
      } 

      // PAYMENT FAILED
      if (event.url.match("mobile/closeFail")) {
        
        browser.close();
        this.showAlert('Sorry, payment failed. Try another payment method');
      }          
      // PAYMENT SUCCESS
      if (event.url.match("mobile/closeOk")) {

        this.ga.trackEvent('package', 'payment success', 'Midtrans', parseInt(this.transactionDetails.amount))
        .then(() => {
        });

        browser.close();
        let loading = this.loadingCtrl.create({
          content: 'Payment success. Updating package status...',
          dismissOnPageChange: true
        });

        loading.present();

        this.userPackage.payment_method = 2; // 1 for bank, 2 for credit card, 3 paypal
        this.userPackage.payment_status = 1; // 1 == paid
        this.userPackage.status         = 1; // 1 == bisa bikin schedule
        this.userPackage.session_complete   = 0;

        // BECAUSE THE PAYMENT WAS SUCCESS
        // REGISTER PACKAGE WITH ALL STATUS 1
        let token   = localStorage.getItem("token");
        var headers = new Headers();
        
        headers.append("Accept", 'application/json');
        headers.append('Content-Type', 'application/json' );
        headers.append('Authorization','Bearer '+token);
        
        let options = new RequestOptions({ headers: headers });
        
        this.http.post(this.helper.url+"/package/register", this.userPackage , options)
        .map(res => {
          
            this.responseStatus = res.status;
            return res.json() })
        .subscribe(data => {
    
          this.navCtrl.push( TabsPage, { index: 3 } ).then(() => {
            
            // Clear the payment info page from view stack
            // Why I do this? because I dont want to after system direct to index 3,
            // and user press back button it direct back to payment info page.
            const index = this.navCtrl.getActive().index;
            this.navCtrl.remove(0, index);
            var t: Tabs = this.navCtrl.parent;
            t.select(3);
            
          });
            
        }, error => {

            loading.dismiss();
            this.responseStatus = error.status;
            this.errorMessage = error.json().error;
            this.showAlert(this.errorMessage);
        
        });
        // END REGISTER
      }

    })
    
  }

  transferPayment() {
    
    this.ga.trackEvent('package', 'choose payment', 'Transfer', parseInt(this.paymentValue))
    .then(() => {
    });

    this.userPackage.payment_method     = 1; // 1 for bank, 2 for credit card, 3 paypal
    this.userPackage.payment_status     = 0; // 1 == paid
    this.userPackage.status             = 0; // 1 == bisa bikin schedule
    this.userPackage.session_complete   = 0;
    this.userPackage.payment_amount     = this.paymentValue;
      // this.navCtrl.push( PaymentinfoPage, { package : this.userPackage, bank : this.bank} );
    
    console.log( this.userPackage );

    // BECAUSE THE PAYMENT WAS SUCCESS
    // REGISTER PACKAGE WITH ALL STATUS 1
    let token   = localStorage.getItem("token");
    var headers = new Headers();
    
    headers.append("Accept", 'application/json');
    headers.append('Content-Type', 'application/json' );
    headers.append('Authorization','Bearer '+token);
    
    let options = new RequestOptions({ headers: headers });
    
    this.http.post(this.helper.url+"/package/register", this.userPackage , options)
    .map(res => {
      
        this.responseStatus = res.status;
        return res.json()})
    .subscribe(data => {

      this.navCtrl.push( PaymentinfoPage, { package : this.userPackage, bank : this.bank } );
        
    }, error => {

        this.responseStatus = error.status;
        this.errorMessage = error.json().error;
        this.showAlert( this.errorMessage );
    
    });
    // END REGISTER

  }

  sendMessageConfirmation() {
    var headers = new Headers();
    headers.append("Authorization", 'Basic ' + this.helper.mainApiTokenBarier);
    headers.append('Content-Type', 'application/x-www-form-urlencoded' );
    this.http.post( this.helper.urlMainApi + '/token', "grant_type=client_credentials" , { headers: headers }).map(res => {
        this.responseStatus = res.status;
        return res.json()})
      .subscribe(data => {

        this.mainApiToken = data.access_token;
        let dataSend = {
          msisdn: this.user.phone,
          content: 'Hai, ' + this.user.username + '. Terimakasih, pembelian paket '+ this.productName +'di Natieva telah berhasil.';
        };

        var headers2 = new Headers();
        headers2.append("Authorization", 'Basic ' + this.mainApiToken);
        headers2.append('Content-Type', 'application/x-www-form-urlencoded' );
        this.http.put( this.helper.urlMainApi + '/smsnotification/1.0.0/message', JSON.stringify(dataSend), { headers: headers2 }).map(res => {
          this.responseStatus = res.status;
          return res.json()})
        .subscribe(data => {
          
        }, error => {
    
          console.log( error );
          
        }); 

      }, error => {
        console.log( error );
    });
  }

  tMoneyPayment() {

    this.idActiveState = 2331;

    var headers = new Headers();
    headers.append("Authorization", 'Basic ' + this.helper.mainApiTokenBarier);
    headers.append('Content-Type', 'application/x-www-form-urlencoded' );
    this.http.post( this.helper.urlMainApi + '/token', "grant_type=client_credentials" , { headers: headers }).map(res => {
        this.responseStatus = res.status;
        return res.json()})
      .subscribe(data => {

        this.mainApiToken = data.access_token;
        let dataSend = {
          msisdn: this.user.phone,
          content: 'Pembayaran melalui T-Money';
        };

        var headers2 = new Headers();
        headers2.append("Authorization", 'Basic ' + this.mainApiToken);
        headers2.append('Content-Type', 'application/x-www-form-urlencoded' );
        this.http.put( this.helper.urlMainApi + '/tmoney/1.0.0-sandbox', JSON.stringify(dataSend), { headers: headers2 }).map(res => {
          this.responseStatus = res.status;
          return res.json()})
        .subscribe(data => {
          
        }, error => {
    
          console.log( error );
          
        }); 

      }, error => {
        console.log( error );
    });

  }


}
