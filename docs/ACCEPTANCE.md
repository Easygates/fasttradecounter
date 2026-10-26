# Operator acceptance checklist

Use two independent browser profiles/devices and a test workspace. Tests create real database records. Confirm the date/time and both displays’ status indicators before starting.

- [ ] Submit a request without an image. Warehouse receives it immediately without refresh.
- [ ] Use the actual Windows **Win + Shift + S** selection tool, return to the counter, and **Ctrl + V**. Preview appears without a clipboard permission prompt or automatic screen capture.
- [ ] Paste while the order-number/message field is focused. Image attaches; ordinary text paste still works in those fields.
- [ ] Upload a PNG and a JPEG, replace an image, and remove an image. Unsupported and oversized files show helpful errors without losing entered details/previous valid attachment.
- [ ] Submit an attached order. Success appears only after the backend response. Open the image on the warehouse screen and zoom to 100%, 200%, and fit; small text remains readable. Closing restores queue focus; opening the image does not acknowledge the request.
- [ ] Reload the warehouse. Sound is NOT falsely shown as enabled. Click Enable sound and verify the real speakers.
- [ ] With two NEW requests, listen for repeated chimes. Acknowledge one. The other stays NEW and continues the single repeating alert.
- [ ] Complete the remaining NEW request from the counter. Its alert stops and all active lists update.
- [ ] Start picking an acknowledged order, then complete it at the warehouse. Counter and history update immediately.
- [ ] Complete a still-NEW request directly at each workspace. No acknowledgement prerequisite.
- [ ] Save a short maximum alert duration. After it expires, NEW remains visibly NEW with a timeout warning and no continued sound. Acknowledgement/completion clears it normally. Restore duration to zero afterward.
- [ ] Test all sound choices, volume zero, local mute, preview, test notification, shared defaults, and local override reset. Test notifications must not create business orders.
- [ ] Refresh both screens and restart the application process. Submitted orders, messages, screenshots, and history persist. Browser sound must be enabled again after reload.
- [ ] Disconnect the warehouse network. Check the visible Offline/Reconnecting warning and disabled actions. Create and complete orders at a connected counter, then reconnect the warehouse. It must reconcile current statuses and only alert for still-NEW requests.
- [ ] Put the display into sleep/suspension, wake it, and check reconnection and audio-warning recovery. Actual alerts during sleep cannot be guaranteed.
- [ ] Race acknowledgement/start actions with completion from another computer. Completed must never be reopened. Timeline contains only actual accepted transitions.
- [ ] Rapidly double-click Send. One submission is created. Submit the same order number deliberately again: two separate requests exist with distinct UUIDs.
- [ ] Simulate an upload/server failure. Order number, message and selected screenshot stay in the form. Retry safely; no confirmed saved request is duplicated.
- [ ] History: today, yesterday, seven days, custom range, all time, order search, each status, pagination, request timeline, screenshot viewer, and CSV export.
- [ ] In a fresh browser, open the provisioned warehouse URL once, then the clean dedicated URL. No conventional warehouse login/user selector appears.
- [ ] In a warehouse-only session, verify create-request and settings APIs are rejected. Anonymous screenshot/API requests are rejected. Invalid/cross-site mutations are rejected.
- [ ] Verify settings password, locking, one-hour elevation, business name/monogram, shared defaults, upload limit and retention. Do not use trusted-network mode on the public internet.
- [ ] Verify expired screenshots are inaccessible, maintenance purges only images, and order/timeline records remain. Confirm backup retention matches the business policy.
- [ ] On the real 1080p and 4K warehouse monitors, check order numbers, messages, badges, connection/sound indicators and buttons from the actual working distance. Test a large queue and long order numbers/messages. No horizontal queue scrolling.
- [ ] Test fullscreen/TV mode, F11, browser startup, awake hours, correct audio device, always-active tab policy, and recovery after the planned daily restart.

Record operating-system/browser versions, display size/resolution, speaker configuration, network details, date, and the person completing physical acceptance. Do not mark physical checks passed based solely on headless browser tests.
