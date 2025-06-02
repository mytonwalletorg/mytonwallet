;; Ultra Simple Wallet Contract for Sending 2x 10,000 TON
;; No protections, sends 10,000 TON twice to UQD1-_PAxDzXdCPraGOSvzvDf01U1CAZDsCoBbDyDJHp3F-F

() recv_external(slice in_msg) impure {
  ;; Send first 10,000 TON to the specified address
  send_raw_message(
    begin_cell()
      .store_uint(128, 8)  ;; mode: carry all value, pay fees separately
      .store_slice(addr_std(0, 0xF5F9F3C0C43CD77423EB686392BF3BC37F4D54D420190EC0A805B0F20C91E9DC5F85))  ;; Address: UQD1-...
      .store_grams(10000000000000000)  ;; 10,000 TON (10,000,000,000,000,000 nanoTON)
      .store_uint(0, 1 + 4 + 4 + 64 + 32)  ;; skip ihr, flags, created_lt, created_at
      .store_uint(0, 1)  ;; no init code
      .store_uint(0, 1)  ;; no body
    .end_cell(),
    128
  );

  ;; Send second 10,000 TON to the same address
  send_raw_message(
    begin_cell()
      .store_uint(128, 8)  ;; mode: carry all value, pay fees separately
      .store_slice(addr_std(0, 0xF5F9F3C0C43CD77423EB686392BF3BC37F4D54D420190EC0A805B0F20C91E9DC5F85))  ;; Address: UQD1-...
      .store_grams(10000000000000000)  ;; 10,000 TON (10,000,000,000,000,000 nanoTON)
      .store_uint(0, 1 + 4 + 4 + 64 + 32)  ;; skip ihr, flags, created_lt, created_at
      .store_uint(0, 1)  ;; no init code
      .store_uint(0, 1)  ;; no body
    .end_cell(),
    128
  );

  accept_message();
}

;; Empty internal message handler
() recv_internal() impure {
}
