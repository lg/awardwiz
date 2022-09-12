// This is the antd date selector converted for dayjs as per https://ant.design/docs/react/replace-moment

import { Dayjs } from "dayjs"
import dayjsGenerateConfig from "rc-picker/lib/generate/dayjs"
import generatePicker from "antd/es/date-picker/generatePicker"
import "antd/lib/date-picker/style/index.css"

const DatePickerDayJs = generatePicker<Dayjs>(dayjsGenerateConfig)

export default DatePickerDayJs
