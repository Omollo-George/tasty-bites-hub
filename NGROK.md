gTesting M-Pesa callbacks locally using ngrok

1) Install ngrok
- Download from https://ngrok.com/ and install for Windows.
- (Optional) Authenticate your ngrok client:

  ngrok authtoken <YOUR_AUTHTOKEN>

2) Run your Django server (on port 8000)

```powershell
cd c:\Users\Admin\Desktop\tasty-bites-hub\tastybites
python -m venv .venv             # optional, if you use a venv
.\.venv\Scripts\Activate.ps1  # optional
pip install -r requirements.txt  # if you have one, otherwise install Django and requests
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

3) Start ngrok to forward HTTPS to your local Django port

```powershell
# simple: exposes your localhost:8000 at an HTTPS url
ngrok http 8000
```

Ngrok will print two "Forwarding" addresses; copy the HTTPS one, e.g. `https://abcd1234.ngrok.io`.

4) Set the `MPESA_CALLBACK_URL` environment variable to point to your callback endpoint

In PowerShell (temporary for the session):

```powershell
$Env:MPESA_CALLBACK_URL = "https://abcd1234.ngrok.io/api/payments/callback/"
```

Or set it permanently via System settings or a `.env` loader if you prefer.

5) Restart Django (if it was running) so `settings.py` picks up the env var.

6) Trigger an STK push from the frontend or curl
- Use the app UI: Add to Order → enter phone → Confirm.
- Or manually POST to the STK endpoint (replace phone):

```powershell
curl -X POST https://127.0.0.1:8000/api/payments/stk/ -H "Content-Type: application/json" -d '{"phone":"2547XXXXXXXX","amount":9.99,"item":"Test"}'
```

7) Observe callbacks
- Watch the Django console output — the `/api/payments/callback/` view will receive the JSON from Daraja and record the transaction in the `Transaction` model.
- Alternatively, open the ngrok web inspector at http://127.0.0.1:4040 — you can inspect incoming requests and replay them.

8) Simulate Daraja callback (manual test)
If you want to test the callback handler without Daraja, POST a sample payload to the ngrok URL:

```powershell
curl -X POST https://abcd1234.ngrok.io/api/payments/callback/ -H "Content-Type: application/json" -d '{"Body":{"stkCallback":{"MerchantRequestID":"12345","CheckoutRequestID":"ABC123","ResultCode":0,"ResultDesc":"The service request is processed successfully.","CallbackMetadata":{"Item":[{"Name":"Amount","Value":9.99},{"Name":"MpesaReceiptNumber","Value":"ABC123"},{"Name":"PhoneNumber","Value":"254712345678"}]}}}}'
```

9) Verify status via the status endpoint (optional)

```powershell
curl "https://127.0.0.1:8000/api/payments/status/?checkout_id=ABC123"
```

Notes
- Make sure your `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, and other credentials in `tastybites/tastybites/settings.py` are correct for sandbox testing.
- Use the ngrok HTTPS URL (not HTTP) in `MPESA_CALLBACK_URL` because Daraja requires HTTPS callbacks.
- If Daraja cannot reach your ngrok endpoint, check the ngrok inspector and the Django logs for errors.

If you want, I can add a small helper script to start ngrok and export the env var automatically.