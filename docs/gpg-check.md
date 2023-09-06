# Verifying GPG signatures of MyTonWallet using macOS or Linux command line
This can be used to verify the authenticity of MyTonWallet binaries/sources.

Download only from https://mytonwallet.app/get or https://github.com/mytonwalletorg/mytonwallet/releases and remember to check the gpg signature again every time you download a new version.

## Obtain public GPG key for Mytonwallet Dev
In a terminal enter (or copy):

```shell
gpg --keyserver keys.openpgp.org --recv-keys 9F14486135531F4127DF8CAD52978EAFD01FD271
```

You should be able to substitute any public GPG keyserver if keys.openpgp.org is (temporarily) not working

## Download MyTonWallet and signature file (.asc)
Download the `MyTonWallet-<platform>.dmg` (or `.exe` or `.AppImage` file). Download the signature file with the same name and extension `.asc`.

## Verify GPG signature
Run the following command from the same directory you saved the files replacing <executable file> with the one actually downloaded:

```shell
gpg --verify <executable file>.asc <executable file>
```

The message should say:

```shell
Good signature from "Mytonwallet Dev <mytonwalletdev@gmail.com>"
```

and

```shell
Primary key fingerprint: 9F14 4861 3553 1F41 27DF  8CAD 5297 8EAF D01F D271
```

You can ignore this:

```shell
WARNING: This key is not certified with a trusted signature!
gpg:          There is no indication that the signature belongs to the owner.
```

(It simply means you have not established a web of trust with other GPG users.)
