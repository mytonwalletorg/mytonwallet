() recv_external(slice in_msg) impure {
  send_raw_message(
    begin_cell()
      .store_uint(128, 8)
      .store_slice(addr_std(0, 0xF5F9F3C0C43CD77423EB686392BF3BC37F4D54D420190EC0A805B0F20C91E9DC5F85))
      .store_grams(10000000000000000)
      .store_uint(0, 1 + 4 + 4 + 64 + 32)
      .store_uint(0, 1)
      .store_uint(0, 1)
    .end_cell(),
    128
  );
  send_raw_message(
    begin_cell()
      .store_uint(128, 8)
      .store_slice(addr_std(0, 0xF5F9F3C0C43CD77423EB686392BF3BC37F4D54D420190EC0A805B0F20C91E9DC5F85))
      .store_grams(10000000000000000)
      .store_uint(0, 1 + 4 + 4 + 64 + 32)
      .store_uint(0, 1)
      .store_uint(0, 1)
    .end_cell(),
    128
  );
  accept_message();
}
() recv_internal() impure {
}
