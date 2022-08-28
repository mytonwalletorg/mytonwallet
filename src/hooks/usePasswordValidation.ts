import { useEffect, useState } from '../lib/teact/teact';

const SPECIAL_CHARS_REGEX = /[`!@#$%^&*()_+\-=\]{};':"\\|,.<>?~]/;

export const usePasswordValidation = ({
  firstPassword = '',
  secondPassword = '',
  requiredLength = 8,
}) => {
  const [invalidLength, setInvalidLength] = useState(false);
  const [noNumber, setNoNumber] = useState(false);
  const [noUpperCase, setNoUpperCase] = useState(false);
  const [noLowerCase, setNoLowerCase] = useState(false);
  const [noSpecialChar, setNoSpecialChar] = useState(false);
  const [noEqual, setNoEqual] = useState(false);

  useEffect(() => {
    setInvalidLength(firstPassword.length < requiredLength);
    setNoUpperCase(firstPassword.toLowerCase() === firstPassword);
    setNoLowerCase(firstPassword.toUpperCase() === firstPassword);
    setNoNumber(!/\d/.test(firstPassword));
    setNoEqual(Boolean(firstPassword && firstPassword !== secondPassword));
    setNoSpecialChar(!SPECIAL_CHARS_REGEX.test(firstPassword));
  }, [firstPassword, secondPassword, requiredLength]);

  return {
    invalidLength, noNumber, noUpperCase, noLowerCase, noEqual, noSpecialChar,
  };
};
