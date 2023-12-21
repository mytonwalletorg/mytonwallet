import { useEffect, useState } from '../lib/teact/teact';

const SPECIAL_CHARS_REGEX = /[`!@#$%^&*()_+\-=\]{};':"\\|,.<>?~]/;

interface OwnProps {
  firstPassword?: string;
  secondPassword?: string;
  requiredMinLength?: number;
  requiredLength?: number;
  isOnlyNumbers?: boolean;
}

export const usePasswordValidation = ({
  firstPassword = '',
  secondPassword = '',
  requiredMinLength = 8,
  requiredLength,
  isOnlyNumbers,
}: OwnProps) => {
  const [invalidLength, setInvalidLength] = useState(false);
  const [noNumber, setNoNumber] = useState(false);
  const [noUpperCase, setNoUpperCase] = useState(false);
  const [noLowerCase, setNoLowerCase] = useState(false);
  const [noSpecialChar, setNoSpecialChar] = useState(false);
  const [noEqual, setNoEqual] = useState(false);

  useEffect(() => {
    const isInvalidLength = Boolean(
      (!requiredLength && firstPassword.length < requiredMinLength)
      || (requiredLength && firstPassword.length !== requiredLength),
    );
    setInvalidLength(isInvalidLength);
    setNoUpperCase(!isOnlyNumbers && firstPassword.toLowerCase() === firstPassword);
    setNoLowerCase(!isOnlyNumbers && firstPassword.toUpperCase() === firstPassword);
    setNoNumber(!/\d/.test(firstPassword));
    setNoEqual(Boolean(firstPassword && firstPassword !== secondPassword));
    setNoSpecialChar(!isOnlyNumbers && !SPECIAL_CHARS_REGEX.test(firstPassword));
  }, [firstPassword, secondPassword, requiredMinLength, isOnlyNumbers, requiredLength]);

  return {
    invalidLength, noNumber, noUpperCase, noLowerCase, noEqual, noSpecialChar,
  };
};
